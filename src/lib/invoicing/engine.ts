// Calcolo della fattura del fornitore: righe, IVA per aliquota/natura, ritenuta d'acconto, marca da bollo, totali.
// Tutti i conti si fanno in centesimi interi, così non ci sono errori di arrotondamento.
// Nessun import: questo file si prova anche da solo (scripts di verifica).

export type Regime = "RF01" | "RF02" | "RF19"; // ordinario, minimi, forfettario
export type Natura = "N1" | "N2.1" | "N2.2" | "N4";
export type LineKind = "servizio" | "spesa" | "bollo";

export const VAT_RATES = [22, 10, 5, 4, 0] as const;

export const NATURE: Record<Natura, { label: string; norma: string }> = {
  N1: { label: "Esclusa art. 15 (spese anticipate, bollo)", norma: "Escluso art. 15 DPR 633/72" },
  "N2.1": { label: "Non soggetta art. 7-ter (servizi a clienti UE)", norma: "Non soggetta art. 7-ter DPR 633/72" },
  "N2.2": { label: "Non soggetta (regime forfettario)", norma: "Operazione in franchigia da IVA ai sensi dell'art. 1, commi 54-89, L. 190/2014" },
  N4: { label: "Esente art. 10", norma: "Esente art. 10 DPR 633/72" },
};

export const REGIMES: Record<Regime, string> = {
  RF01: "Ordinario",
  RF19: "Forfettario",
  RF02: "Contribuenti minimi",
};

export type Party = {
  name: string; // denominazione (o nome e cognome per le persone)
  person?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  vat: string | null; // partita IVA (per l'estero con il prefisso del paese, es. FR123...)
  tax_code?: string | null;
  address: string;
  postal_code?: string | null;
  city: string;
  province?: string | null;
  country: string; // codice a 2 lettere
  sdi_code?: string | null;
  pec?: string | null;
};

export type InvoiceLine = {
  id: string;
  order_id?: string | null;
  kind: LineKind;
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price: number; // senza IVA
  vat_rate: number; // 0 se c'è una natura
  natura?: Natura | null;
  ritenuta: boolean; // la riga è soggetta a ritenuta d'acconto
};

export type RitenutaSettings = { enabled: boolean; rate: number; type: "RT01" | "RT02"; causale: string };

export type InvoiceDoc = {
  version: 1;
  seller: Party;
  buyer: Party;
  regime: Regime;
  ritenuta: RitenutaSettings;
  lines: InvoiceLine[];
  bollo: boolean; // marca da bollo virtuale da 2 € sulla fattura
  payment: { iban?: string | null; bank?: string | null; method: "MP05" };
  notes?: string | null; // causale / note in fattura
};

export type Riepilogo = { vat_rate: number; natura: Natura | null; imponibile: number; imposta: number; norma: string | null };

export type Totals = {
  imponibile: number; // somma delle righe (bollo compreso, se addebitato)
  iva: number;
  totale: number; // totale documento
  ritenuta: number;
  ritenutaBase: number;
  bollo: number; // 2 se c'è la marca da bollo
  netto: number; // da pagare
  riepilogo: Riepilogo[];
  lineTotals: Record<string, number>;
};

export const BOLLO_AMOUNT = 2;
export const BOLLO_THRESHOLD = 77.47;

// ---- centesimi ----
export const toCents = (n: number): number => Math.round((Number(n) || 0) * 100 + (n >= 0 ? 1e-7 : -1e-7));
export const fromCents = (c: number): number => Math.round(c) / 100;
const pctOf = (cents: number, rate: number): number => {
  const raw = (cents * rate) / 100;
  return raw >= 0 ? Math.floor(raw + 0.5 + 1e-9) : -Math.floor(-raw + 0.5 + 1e-9);
};

// Totale di una riga: quantità × prezzo, arrotondato al centesimo
export function lineTotalCents(l: Pick<InvoiceLine, "quantity" | "unit_price">): number {
  const q = Number(l.quantity) || 0;
  const raw = q * (Number(l.unit_price) || 0) * 100;
  return raw >= 0 ? Math.floor(raw + 0.5 + 1e-7) : -Math.floor(-raw + 0.5 + 1e-7);
}

// Aliquota e natura di partenza per una riga, secondo il regime del fornitore
export function defaultTax(regime: Regime, kind: LineKind, defaultVat: number, defaultNatura: Natura | null): { vat_rate: number; natura: Natura | null } {
  if (kind === "spesa" || kind === "bollo") return { vat_rate: 0, natura: "N1" };
  if (regime === "RF19" || regime === "RF02") return { vat_rate: 0, natura: "N2.2" };
  if (defaultVat === 0) return { vat_rate: 0, natura: defaultNatura ?? "N2.1" };
  return { vat_rate: defaultVat, natura: null };
}

// La marca da bollo serve quando gli importi senza IVA superano 77,47 €
export function bolloRequired(lines: InvoiceLine[]): boolean {
  const base = lines
    .filter((l) => l.kind !== "bollo" && l.vat_rate === 0 && l.natura && ["N1", "N2.1", "N2.2", "N4"].includes(l.natura))
    .reduce((s, l) => s + lineTotalCents(l), 0);
  return base > toCents(BOLLO_THRESHOLD);
}

export function computeTotals(doc: Pick<InvoiceDoc, "lines" | "ritenuta" | "bollo">): Totals {
  const groups = new Map<string, { vat_rate: number; natura: Natura | null; imponibile: number }>();
  const lineTotals: Record<string, number> = {};
  let ritenutaBase = 0;
  for (const l of doc.lines) {
    const t = lineTotalCents(l);
    lineTotals[l.id] = fromCents(t);
    const natura = l.vat_rate === 0 ? (l.natura ?? null) : null;
    const key = `${l.vat_rate}|${natura ?? ""}`;
    const g = groups.get(key) ?? { vat_rate: l.vat_rate, natura, imponibile: 0 };
    g.imponibile += t;
    groups.set(key, g);
    if (doc.ritenuta.enabled && l.ritenuta && l.kind === "servizio") ritenutaBase += t;
  }
  const riepilogo: Riepilogo[] = [...groups.values()]
    .sort((a, b) => b.vat_rate - a.vat_rate || (a.natura ?? "").localeCompare(b.natura ?? ""))
    .map((g) => ({
      vat_rate: g.vat_rate,
      natura: g.natura,
      imponibile: fromCents(g.imponibile),
      imposta: fromCents(g.vat_rate > 0 ? pctOf(g.imponibile, g.vat_rate) : 0),
      norma: g.natura ? NATURE[g.natura].norma : null,
    }));
  const imponibile = riepilogo.reduce((s, r) => s + toCents(r.imponibile), 0);
  const iva = riepilogo.reduce((s, r) => s + toCents(r.imposta), 0);
  const ritenuta = doc.ritenuta.enabled ? pctOf(ritenutaBase, doc.ritenuta.rate) : 0;
  const totale = imponibile + iva;
  return {
    imponibile: fromCents(imponibile),
    iva: fromCents(iva),
    totale: fromCents(totale),
    ritenuta: fromCents(ritenuta),
    ritenutaBase: fromCents(ritenutaBase),
    bollo: doc.bollo ? BOLLO_AMOUNT : 0,
    netto: fromCents(totale - ritenuta),
    riepilogo,
    lineTotals,
  };
}

// Aggiunge o toglie la riga «rimborso marca da bollo» (quando il bollo è a carico del cliente)
export function withBolloLine(lines: InvoiceLine[], bollo: boolean, charge: boolean): InvoiceLine[] {
  const rest = lines.filter((l) => l.kind !== "bollo");
  if (!bollo || !charge) return rest;
  return [
    ...rest,
    { id: "bollo", kind: "bollo", description: "Rimborso spese marca da bollo", quantity: 1, unit: null, unit_price: BOLLO_AMOUNT, vat_rate: 0, natura: "N1", ritenuta: false },
  ];
}

// ---- controlli prima di emettere ----
const VAT_IT = /^\d{11}$/;
export function isValidItalianVat(v: string): boolean {
  if (!VAT_IT.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(v[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(v[10]);
}

export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  if (iban.startsWith("IT") && iban.length !== 27) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const val = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of val) rem = (rem * 10 + Number(digit)) % 97;
  }
  return rem === 1;
}

export type Problem = { level: "errore" | "avviso"; text: string };

// Cosa manca o non torna, in parole semplici. Gli «errori» bloccano l'XML; gli «avvisi» vanno solo letti.
export function checkInvoice(doc: InvoiceDoc, meta: { number: string | null; issueDate: string | null; currency: string }): Problem[] {
  const p: Problem[] = [];
  const s = doc.seller;
  const b = doc.buyer;
  if (!meta.number?.trim()) p.push({ level: "errore", text: "Manca il numero della fattura." });
  if (!meta.issueDate) p.push({ level: "errore", text: "Manca la data della fattura." });
  if (doc.lines.length === 0) p.push({ level: "errore", text: "La fattura non ha righe." });
  doc.lines.forEach((l, i) => {
    const n = i + 1;
    if (!l.description.trim()) p.push({ level: "errore", text: `Riga ${n}: manca la descrizione.` });
    if (!(Number(l.quantity) > 0)) p.push({ level: "errore", text: `Riga ${n}: la quantità deve essere maggiore di zero.` });
    if (l.vat_rate === 0 && !l.natura) p.push({ level: "errore", text: `Riga ${n}: senza IVA serve indicare il motivo (natura).` });
    if (l.vat_rate > 0 && l.natura) p.push({ level: "errore", text: `Riga ${n}: con l'IVA non si indica la natura.` });
    if (!(VAT_RATES as readonly number[]).includes(l.vat_rate)) p.push({ level: "errore", text: `Riga ${n}: aliquota IVA non valida.` });
  });
  const t = computeTotals(doc);
  if (t.totale <= 0) p.push({ level: "errore", text: "Il totale della fattura deve essere maggiore di zero." });
  if (s.country === "IT") {
    if (!s.vat || !isValidItalianVat(s.vat)) p.push({ level: "errore", text: "La tua partita IVA non è valida: correggila nel profilo." });
    if (!s.postal_code || !/^\d{5}$/.test(s.postal_code)) p.push({ level: "errore", text: "Manca il CAP della tua sede (profilo)." });
    if (!s.province) p.push({ level: "errore", text: "Manca la provincia della tua sede (profilo)." });
    if (s.person && (!s.first_name?.trim() || !s.last_name?.trim())) p.push({ level: "errore", text: "Per una persona fisica servono nome e cognome (impostazioni di fatturazione)." });
  }
  if (!s.address?.trim() || !s.city?.trim()) p.push({ level: "errore", text: "Manca l'indirizzo della tua sede (profilo)." });
  if (!b.name?.trim()) p.push({ level: "errore", text: "Manca il nome del cliente." });
  if (!b.address?.trim() || !b.city?.trim()) p.push({ level: "errore", text: "Manca l'indirizzo del cliente." });
  if (b.country === "IT") {
    if (!b.vat && !b.tax_code) p.push({ level: "errore", text: "Manca la partita IVA o il codice fiscale del cliente." });
    if (b.vat && !isValidItalianVat(b.vat)) p.push({ level: "errore", text: "La partita IVA del cliente non sembra corretta." });
    if (!b.postal_code || !/^\d{5}$/.test(b.postal_code)) p.push({ level: "errore", text: "Manca il CAP del cliente." });
    if (!(b.sdi_code && /^[A-Z0-9]{7}$/.test(b.sdi_code)) && !b.pec)
      p.push({ level: "avviso", text: "Il cliente non ha codice SDI né PEC: la fattura arriverà nel suo cassetto fiscale (codice 0000000)." });
  }
  if (meta.currency !== "EUR" && s.country === "IT") p.push({ level: "avviso", text: "Fattura in valuta diversa dall'euro: controlla con il commercialista." });
  if (doc.regime !== "RF01" && doc.lines.some((l) => l.vat_rate > 0)) p.push({ level: "avviso", text: "Sei in regime forfettario/minimi ma alcune righe hanno l'IVA." });
  if (doc.regime !== "RF01" && doc.ritenuta.enabled) p.push({ level: "avviso", text: "In regime forfettario di solito non si applica la ritenuta d'acconto." });
  const needBollo = bolloRequired(doc.lines);
  if (needBollo && !doc.bollo) p.push({ level: "avviso", text: "Gli importi senza IVA superano 77,47 €: di solito serve la marca da bollo da 2 €." });
  if (!needBollo && doc.bollo) p.push({ level: "avviso", text: "Hai messo la marca da bollo, ma gli importi senza IVA non superano 77,47 €." });
  if (doc.payment.iban && !isValidIban(doc.payment.iban)) p.push({ level: "errore", text: "L'IBAN non è valido (impostazioni di fatturazione)." });
  if (!doc.payment.iban) p.push({ level: "avviso", text: "Manca l'IBAN: il cliente non saprà dove pagarti." });
  return p;
}

// Numero suggerito, es. «12/2026»
export function formatInvoiceNumber(pattern: string, n: number, year: number): string {
  return pattern.replace("{n}", String(n)).replace("{anno}", String(year)).slice(0, 20);
}

export const money = (n: number, currency = "EUR"): string =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
