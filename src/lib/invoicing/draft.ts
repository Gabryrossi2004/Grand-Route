// Bozza di fattura precompilata dai servizi svolti: intestazioni dalla Rete, righe dagli ordini e dalle variazioni,
// IVA / ritenuta / bollo secondo le impostazioni del fornitore.
import { bolloRequired, defaultTax, formatInvoiceNumber, withBolloLine, type InvoiceDoc, type InvoiceLine, type Natura, type Party, type Regime } from "./engine";
import { fmtDate, type OrderRow } from "@/lib/orders/shared";

export type BillingSettings = {
  person: boolean;
  first_name: string | null;
  last_name: string | null;
  regime: Regime;
  default_vat: number;
  default_natura: Natura | null;
  ritenuta: boolean;
  ritenuta_rate: number;
  ritenuta_type: "RT01" | "RT02";
  bollo_charge: boolean;
  iban: string | null;
  bank: string | null;
  payment_days: number;
  next_number: number;
  number_pattern: string;
  free_cancel_days: number;
  penalty_pct: number;
  invoice_notes: string | null;
  auto_reminders?: boolean;
};

export const DEFAULT_SETTINGS: BillingSettings = {
  person: false,
  first_name: null,
  last_name: null,
  regime: "RF01",
  default_vat: 22,
  default_natura: null,
  ritenuta: false,
  ritenuta_rate: 20,
  ritenuta_type: "RT01",
  bollo_charge: true,
  iban: null,
  bank: null,
  payment_days: 30,
  next_number: 1,
  number_pattern: "{n}/{anno}",
  free_cancel_days: 2,
  penalty_pct: 100,
  invoice_notes: null,
  auto_reminders: true,
};

type ProfileData = {
  business_name: string;
  country: string;
  vat_number: string | null;
  tax_code: string | null;
  sdi_code?: string | null;
  pec?: string | null;
  address: string;
  postal_code: string | null;
  city: string;
  province: string | null;
};

export function partyFromProfile(p: ProfileData, s?: Pick<BillingSettings, "person" | "first_name" | "last_name"> | null): Party {
  const person = !!s?.person && !!s.first_name && !!s.last_name;
  return {
    name: person ? `${s!.first_name} ${s!.last_name}` : p.business_name,
    person,
    first_name: person ? s!.first_name : null,
    last_name: person ? s!.last_name : null,
    vat: p.vat_number,
    tax_code: p.tax_code,
    address: p.address,
    postal_code: p.postal_code,
    city: p.city,
    province: p.province,
    country: p.country,
    sdi_code: p.sdi_code ?? null,
    pec: p.pec ?? null,
  };
}

const FORFETTARIO_NOTE =
  "Operazione effettuata ai sensi dell'art. 1, commi da 54 a 89, della L. 190/2014 (regime forfettario). Non soggetta a ritenuta d'acconto ai sensi dell'art. 1, comma 67, L. 190/2014.";

function period(o: OrderRow): string {
  return o.end_date && o.end_date !== o.service_date ? `dal ${fmtDate(o.service_date)} al ${fmtDate(o.end_date)}` : fmtDate(o.service_date);
}

export function buildDraft(orders: OrderRow[], seller: Party, buyer: Party, settings: BillingSettings, today: string) {
  const s = settings;
  const lines: InvoiceLine[] = [];
  let n = 0;
  const id = () => `l${++n}`;
  const tax = (kind: "servizio" | "spesa") => defaultTax(s.regime, kind, Number(s.default_vat), s.default_natura);
  const sorted = [...orders].sort((a, b) => a.service_date.localeCompare(b.service_date));
  for (const o of sorted) {
    const ref = o.reference ? ` – Rif. ${o.reference}` : "";
    if (o.phase === "penale" || (o.status === "annullato" && (o.penalty_amount ?? 0) > 0)) {
      // Le penali per cancellazione sono di solito escluse dall'IVA (art. 15)
      lines.push({
        id: id(),
        order_id: o.id,
        kind: "servizio",
        description: `Penale per cancellazione: ${o.title} del ${period(o)}${ref}`,
        quantity: 1,
        unit: null,
        unit_price: Number(o.penalty_amount ?? 0),
        vat_rate: 0,
        natura: "N1",
        ritenuta: false,
      });
      continue;
    }
    const base = tax("servizio");
    lines.push({
      id: id(),
      order_id: o.id,
      kind: "servizio",
      description: `${o.title} – ${period(o)}${o.pax ? ` – ${o.pax} pax` : ""}${ref}`,
      quantity: Number(o.quantity),
      unit: o.unit,
      unit_price: Number(o.unit_price),
      ...base,
      ritenuta: s.ritenuta && s.regime === "RF01",
    });
    for (const e of o.extras.filter((x) => x.state === "accettata")) {
      const t = tax(e.kind);
      lines.push({
        id: id(),
        order_id: o.id,
        kind: e.kind,
        description: `${e.kind === "spesa" ? "Spese anticipate in nome e per conto del cliente: " : ""}${e.description} (${o.title}, ${fmtDate(o.service_date)})`,
        quantity: Number(e.quantity),
        unit: null,
        unit_price: Number(e.unit_price),
        ...t,
        ritenuta: e.kind === "servizio" && s.ritenuta && s.regime === "RF01",
      });
    }
  }
  const bollo = bolloRequired(lines);
  const finalLines = withBolloLine(lines, bollo, s.bollo_charge);
  const notes = [s.regime !== "RF01" ? FORFETTARIO_NOTE : null, s.invoice_notes].filter(Boolean).join(" ");
  const doc: InvoiceDoc = {
    version: 1,
    seller,
    buyer,
    regime: s.regime,
    ritenuta: { enabled: s.ritenuta && s.regime === "RF01", rate: Number(s.ritenuta_rate), type: s.ritenuta_type, causale: "A" },
    lines: finalLines,
    bollo,
    payment: { iban: s.iban, bank: s.bank, method: "MP05" },
    notes: notes || null,
  };
  const year = Number(today.slice(0, 4));
  return { doc, number: formatInvoiceNumber(s.number_pattern, s.next_number, year) };
}
