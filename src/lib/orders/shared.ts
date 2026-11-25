// Ordini di servizio tra partner della Rete: tipi e regole condivise tra pagine e server.
// Le regole sono le stesse del database (migrazione 0065): qui servono solo per mostrare le cose.

export type OrderPhase = "da_confermare" | "confermato" | "svolto" | "penale" | "annullato" | "rifiutato" | "fatturato";
export type ExtraState = "proposta" | "accettata" | "contestata";

export type OrderExtra = {
  id: string;
  created_by: string;
  kind: "servizio" | "spesa";
  description: string;
  quantity: number;
  unit_price: number;
  receipt_path: string | null;
  state: ExtraState;
  proposed_at: string;
  contest_note: string | null;
};

export type OrderRow = {
  id: string;
  role: "seller" | "buyer";
  counterpart: string;
  counterpart_name: string;
  counterpart_kind: string;
  created_by: string;
  last_edit_by: string;
  title: string;
  details: string | null;
  service_date: string;
  end_date: string | null;
  start_time: string | null;
  place: string | null;
  pax: number | null;
  reference: string | null;
  lead_name: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  currency: string;
  free_cancel_days: number;
  penalty_pct: number;
  status: "richiesto" | "confermato" | "rifiutato" | "annullato";
  phase: OrderPhase;
  free_until: string;
  decline_reason: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  penalty_amount: number | null;
  invoice_id: string | null;
  invoice_status: string | null;
  invoice_number: string | null;
  buyer_service_id: string | null;
  trip_id: string | null;
  trip_title: string | null;
  service_net_cost: number | null;
  extras: OrderExtra[];
  created_at: string;
};

export type InvoiceListRow = {
  id: string;
  role: "seller" | "buyer";
  counterpart: string;
  counterpart_name: string;
  status: "bozza" | "emessa" | "pagata" | "stornata";
  number: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string;
  imponibile: number;
  iva: number;
  ritenuta: number;
  bollo: number;
  totale: number;
  netto: number;
  paid_at: string | null;
  emitted_at: string | null;
  created_at: string;
  orders_count: number;
  doc_type?: "TD01" | "TD04";
  credit_of?: string | null;
  credit_of_number?: string | null;
  credited?: number | null; // note di credito parziali emesse
  residuo?: number | null; // da pagare al netto delle note di credito
  reminders_sent?: number;
};

export type OrderPartner = { user_id: string; name: string; kind: string; free_cancel_days: number; penalty_pct: number };

export const EXTRA_SILENCE_DAYS = 3;

export const PHASES: Record<OrderPhase, { label: string; tone: string }> = {
  da_confermare: { label: "Da confermare", tone: "bg-amber-100 text-amber-800" },
  confermato: { label: "In programma", tone: "bg-sky-100 text-sky-800" },
  svolto: { label: "Svolto", tone: "bg-emerald-100 text-emerald-800" },
  penale: { label: "Annullato con penale", tone: "bg-orange-100 text-orange-800" },
  annullato: { label: "Annullato", tone: "bg-slate-100 text-slate-600" },
  rifiutato: { label: "Rifiutato", tone: "bg-slate-100 text-slate-600" },
  fatturato: { label: "In fattura", tone: "bg-violet-100 text-violet-800" },
};

export const INVOICE_STATUS: Record<InvoiceListRow["status"], { label: string; tone: string }> = {
  bozza: { label: "Bozza", tone: "bg-slate-100 text-slate-700" },
  emessa: { label: "Da pagare", tone: "bg-amber-100 text-amber-800" },
  pagata: { label: "Pagata", tone: "bg-emerald-100 text-emerald-800" },
  stornata: { label: "Stornata", tone: "bg-slate-100 text-slate-500" },
};

export const UNITS = ["servizio", "ora", "giorno", "giornata", "notte", "persona", "camera", "km", "pasto", "biglietto"];
export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "AED", "MAD", "EGP", "TRY", "JPY", "THB", "ZAR", "INR", "MXN", "PEN", "BRL", "AUD", "CAD"];

// Data di oggi in Italia (come il database)
export function todayRome(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Stessa regola del database: il giorno dopo la fine del servizio l'ordine è «svolto»
export function orderPhase(
  o: { invoice_id: string | null; status: string; penalty_amount: number | null; service_date: string; end_date: string | null },
  today = todayRome(),
): OrderPhase {
  if (o.invoice_id) return "fatturato";
  if (o.status === "rifiutato") return "rifiutato";
  if (o.status === "annullato") return (o.penalty_amount ?? 0) > 0 ? "penale" : "annullato";
  if ((o.end_date ?? o.service_date) < today) return "svolto";
  if (o.status === "confermato") return "confermato";
  return "da_confermare";
}

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("it-IT", { ...opts, timeZone: "UTC" }) : "";

export const fmtDay = (iso: string) => fmtDate(iso, { weekday: "short", day: "numeric", month: "short" });

export function fmtMoney(n: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export const baseAmount = (o: Pick<OrderRow, "quantity" | "unit_price">) => Math.round(o.quantity * o.unit_price * 100) / 100;

// Totale dell'ordine senza IVA: servizio + variazioni accettate (o penale, se annullato)
export function orderTotal(o: OrderRow, includePending = false): number {
  if (o.status === "annullato") return o.penalty_amount ?? 0;
  if (o.status === "rifiutato") return 0;
  const extras = o.extras
    .filter((e) => e.state === "accettata" || (includePending && e.state === "proposta"))
    .reduce((s, e) => s + Math.round(e.quantity * e.unit_price * 100) / 100, 0);
  return Math.round((baseAmount(o) + extras) * 100) / 100;
}

// Fino a quando si può contestare una variazione
export const extraDeadline = (e: OrderExtra) => {
  const d = new Date(e.proposed_at);
  d.setDate(d.getDate() + EXTRA_SILENCE_DAYS);
  return d;
};

// Perché un ordine svolto non si può ancora fatturare
export function billableBlock(o: OrderRow): string | null {
  if (o.phase === "penale") return null;
  if (o.phase !== "svolto") return "non ancora svolto";
  const pending = o.extras.filter((e) => e.state === "proposta");
  const contested = o.extras.filter((e) => e.state === "contestata");
  if (contested.length) return `${contested.length === 1 ? "una variazione contestata" : `${contested.length} variazioni contestate`}: modificala o toglila`;
  if (pending.length) {
    const last = pending.map(extraDeadline).sort((a, b) => b.getTime() - a.getTime())[0];
    return `variazioni in attesa dell'altra parte fino al ${last.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;
  }
  return null;
}

// L'ordine aspetta una mia conferma?
export const waitingForMe = (o: OrderRow, me: string) => o.phase === "da_confermare" && o.status === "richiesto" && o.last_edit_by !== me;
