// Scheda operativa «day by day»: tipi e costanti condivisi tra pagina, azioni ed esportazione.

export const OPS_TEXT_KEYS = [
  "trip_code",
  "client",
  "agent",
  "supplier",
  "supplier_contact",
  "pax",
  "service",
  "meeting_time",
  "meeting_point",
  "notes",
  "responsible",
] as const;
export type OpsTextKey = (typeof OPS_TEXT_KEYS)[number];

export const OPS_COLORS = ["blu", "giallo", "verde", "rosso", "arancio", "viola", "grigio"] as const;
export type OpsColor = (typeof OPS_COLORS)[number];

// Stato del servizio (colonna «Stato»)
export const OPS_STATUSES = [
  { id: "da_confermare", label: "Da confermare", bg: "#fde2e2", fg: "#9b1c1c", excel: "FFF4CCCC" },
  { id: "confermato", label: "Confermato", bg: "#dcf3e3", fg: "#1f6b3a", excel: "FFD9EAD3" },
  { id: "riconferma_inviata", label: "Riconferma inviata", bg: "#dbeafe", fg: "#1e3a8a", excel: "FFCFE2F3" },
  { id: "riconfermato", label: "Riconfermato", bg: "#1f7a45", fg: "#ffffff", excel: "FF93C47D" },
  { id: "qr_da_inviare", label: "QR / doc. da inviare", bg: "#fff3a3", fg: "#7a5d00", excel: "FFFFF2CC" },
  { id: "cancellato", label: "Cancellato", bg: "#e5e7eb", fg: "#4b5563", excel: "FFEFEFEF" },
] as const;
export type OpsStatus = (typeof OPS_STATUSES)[number]["id"];
export const OPS_STATUS_IDS = OPS_STATUSES.map((s) => s.id) as [OpsStatus, ...OpsStatus[]];
export const opsStatusInfo = (id: string) => OPS_STATUSES.find((s) => s.id === id);

// Campi che arrivano dall'itinerario: se l'itinerario cambia, la riga importata si aggiorna (o lo segnala)
export const OPS_SOURCE_KEYS = [
  "service_date",
  "trip_code",
  "client",
  "supplier",
  "supplier_contact",
  "pax",
  "service",
  "meeting_time",
  "meeting_point",
  "notes",
] as const;
export type OpsSourceKey = (typeof OPS_SOURCE_KEYS)[number];
export type OpsSource = Record<OpsSourceKey, string>;
/** Modifiche arrivate dall'itinerario: applied = già scritta nella riga; "_removed" = attività tolta dall'itinerario. */
export type OpsChange = { from: string; to: string; applied: boolean };
export type OpsChanges = Partial<Record<OpsSourceKey | "_removed", OpsChange>>;

export type OpsRow = {
  id: string;
  service_date: string;
  trip_code: string;
  client: string;
  agent: string;
  supplier: string;
  supplier_contact: string;
  pax: string;
  service: string;
  meeting_time: string;
  meeting_point: string;
  notes: string;
  responsible: string;
  status: OpsStatus | "";
  changes: OpsChanges;
  row_color: OpsColor | null;
  cell_colors: Partial<Record<OpsTextKey, OpsColor>>;
  trip_id: string | null;
  activity_id: string | null;
  created_at: string;
};

export type OpsColumn = { key: "service_date" | OpsTextKey | "status"; label: string; width: number; multiline?: boolean; suggest?: boolean };

export const OPS_COLUMNS: OpsColumn[] = [
  { key: "service_date", label: "Data", width: 64 },
  { key: "trip_code", label: "Codice", width: 86, suggest: true },
  { key: "client", label: "Cliente", width: 150, suggest: true },
  { key: "agent", label: "Agente", width: 150, suggest: true },
  { key: "supplier", label: "Fornitore", width: 150, suggest: true },
  { key: "supplier_contact", label: "Contatto fornitore / emergenze", width: 155, multiline: true },
  { key: "pax", label: "Pax", width: 56 },
  { key: "status", label: "Stato", width: 150 },
  { key: "service", label: "Servizio", width: 270, multiline: true },
  { key: "meeting_time", label: "Orario ritrovo", width: 84 },
  { key: "meeting_point", label: "Punto di ritrovo", width: 150, multiline: true },
  { key: "notes", label: "Note", width: 310, multiline: true },
  { key: "responsible", label: "Responsabile", width: 115, suggest: true },
];

// Colori di evidenziazione: chiaro per la riga intera, pieno per la singola cella (come nel foglio di lavoro)
export const OPS_COLOR_STYLE: Record<OpsColor, { label: string; row: string; cell: string; excelRow: string; excelCell: string }> = {
  blu: { label: "Azzurro", row: "#d6e6f5", cell: "#9ec5ea", excelRow: "FFCFE2F3", excelCell: "FF9FC5E8" },
  giallo: { label: "Giallo", row: "#fdf6c3", cell: "#fff200", excelRow: "FFFFF2CC", excelCell: "FFFFFF00" },
  verde: { label: "Verde", row: "#d9f2df", cell: "#93d9a6", excelRow: "FFD9EAD3", excelCell: "FFB6D7A8" },
  rosso: { label: "Rosso", row: "#fbdcdc", cell: "#f59e9e", excelRow: "FFF4CCCC", excelCell: "FFEA9999" },
  arancio: { label: "Arancio", row: "#fde5cc", cell: "#fbbf77", excelRow: "FFFCE5CD", excelCell: "FFF9CB9C" },
  viola: { label: "Viola", row: "#e9e1f8", cell: "#c4b0ee", excelRow: "FFD9D2E9", excelCell: "FFB4A7D6" },
  grigio: { label: "Grigio", row: "#e8e8e8", cell: "#c4c4c4", excelRow: "FFEFEFEF", excelCell: "FFCCCCCC" },
};

/** Minuti dall'inizio della giornata se il testo contiene un orario ("8:30", "08.30"), altrimenti null. */
export function opsTimeMinutes(text: string): number | null {
  const m = text.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseIsoDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export type OpsView = "giorno" | "settimana" | "mese" | "viaggio";

/** Codice viaggio: 6 caratteri tra lettere e numeri (senza 0/O e 1/I). */
export const TRIP_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const normalizeTripCode = (v: string) => v.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export type OpsTripRef = { id: string; code: string; title: string; client: string; start: string | null; end: string | null };

/** Oggi in Italia (AAAA-MM-GG), più eventuali giorni. */
export function opsToday(addDays = 0) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  if (!addDays) return today;
  const d = parseIsoDate(today);
  d.setDate(d.getDate() + addDays);
  return isoDate(d);
}

/** Periodo mostrato: un giorno, la settimana (lunedì-domenica) o il mese che contiene la data. */
export function opsRange(view: OpsView, anchor: string): { from: string; to: string } {
  const d = parseIsoDate(anchor);
  if (view === "giorno" || view === "viaggio") return { from: anchor, to: anchor };
  if (view === "settimana") {
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: isoDate(monday), to: isoDate(sunday) };
  }
  return { from: isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), to: isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

export const OPS_FIELD_LABEL: Record<OpsSourceKey, string> = {
  service_date: "Data",
  trip_code: "Codice",
  client: "Cliente",
  supplier: "Fornitore",
  supplier_contact: "Contatto",
  pax: "Pax",
  service: "Servizio",
  meeting_time: "Orario ritrovo",
  meeting_point: "Punto di ritrovo",
  notes: "Note",
};

/** Giorni da riconfermare: il giorno dopo; il venerdì fino a lunedì, il sabato fino a lunedì. */
export function riconfermaDays(today: string): string[] {
  const dow = parseIsoDate(today).getDay(); // 0 domenica … 5 venerdì, 6 sabato
  const count = dow === 5 ? 3 : dow === 6 ? 2 : 1;
  return Array.from({ length: count }, (_, i) => {
    const d = parseIsoDate(today);
    d.setDate(d.getDate() + i + 1);
    return isoDate(d);
  });
}

/** Numero di telefono per WhatsApp (solo cifre con prefisso internazionale), o null. */
export function whatsappNumber(text: string): string | null {
  const m = text.match(/(\+|00)?\d[\d\s./-]{6,}\d/);
  if (!m) return null;
  let digits = m[0].replace(/\D/g, "");
  if (m[0].startsWith("+")) return digits.length >= 8 ? digits : null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^(3\d{8,9}|0\d{5,10})$/.test(digits)) digits = `39${digits}`; // numero italiano senza prefisso
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
