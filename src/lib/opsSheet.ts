// Scheda operativa «day by day»: tipi e costanti condivisi tra pagina, azioni ed esportazione.

export const OPS_TEXT_KEYS = [
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

export type OpsRow = {
  id: string;
  service_date: string;
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
  row_color: OpsColor | null;
  cell_colors: Partial<Record<OpsTextKey, OpsColor>>;
  trip_id: string | null;
  activity_id: string | null;
  created_at: string;
};

export type OpsColumn = { key: "service_date" | OpsTextKey; label: string; width: number; multiline?: boolean; suggest?: boolean };

export const OPS_COLUMNS: OpsColumn[] = [
  { key: "service_date", label: "Data", width: 64 },
  { key: "client", label: "Cliente", width: 150, suggest: true },
  { key: "agent", label: "Agente", width: 150, suggest: true },
  { key: "supplier", label: "Fornitore", width: 150, suggest: true },
  { key: "supplier_contact", label: "Contatto fornitore / emergenze", width: 155, multiline: true },
  { key: "pax", label: "Pax", width: 56 },
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

export type OpsView = "giorno" | "settimana" | "mese";

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
  if (view === "giorno") return { from: anchor, to: anchor };
  if (view === "settimana") {
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: isoDate(monday), to: isoDate(sunday) };
  }
  return { from: isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), to: isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}
