// Posta di Grand Route: tipi e piccole regole comuni a pagine e server.

export type MailFolder = "inbox" | "mine" | "general" | "private" | "orders" | "sent" | "starred" | "archived" | "all";

export const FOLDERS: { id: MailFolder; label: string }[] = [
  { id: "inbox", label: "In arrivo" },
  { id: "orders", label: "Richieste di servizio" },
  { id: "sent", label: "Inviati" },
  { id: "starred", label: "Preferiti" },
  { id: "archived", label: "Archiviati" },
  { id: "all", label: "Tutti" },
];
// Cartelle in più per le agenzie con un team: «Le mie» per tutti, «Posta generale» e «Private» per i titolari
export const TEAM_FOLDERS: { id: MailFolder; label: string; titolare: boolean }[] = [
  { id: "mine", label: "Seguite da me", titolare: false },
  { id: "general", label: "Posta generale", titolare: true },
  { id: "private", label: "Private", titolare: true },
];
export function foldersFor(team: { isTitolare: boolean } | null): { id: MailFolder; label: string }[] {
  if (!team) return FOLDERS;
  const extra = TEAM_FOLDERS.filter((f) => !f.titolare || team.isTitolare);
  return [FOLDERS[0], ...extra, ...FOLDERS.slice(1)];
}
export const isFolder = (v: unknown): v is MailFolder =>
  typeof v === "string" && (FOLDERS.some((f) => f.id === v) || TEAM_FOLDERS.some((f) => f.id === v));

export type ThreadRow = {
  thread_id: string;
  subject: string;
  kind: "messaggio" | "richiesta";
  order_id: string | null;
  last_message_at: string;
  unread: boolean;
  starred: boolean;
  archived: boolean;
  participants: { id: string; name: string }[] | null;
  last_author: string | null;
  last_snippet: string | null;
  has_attachments: boolean;
  messages_count: number;
  // posta del team (migrazione 0077)
  assignee_id?: string | null;
  assignee_name?: string | null;
  is_private?: boolean;
  handed_to_me?: boolean;
};

export type MailAttachment = { id: string; message_id: string; path: string; name: string; size_bytes: number | null; mime: string | null };
export type MailMessage = { id: string; author_id: string | null; author_person?: string | null; kind: "messaggio" | "evento"; body: string; created_at: string; draft: boolean };

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 20;

// Data come nelle email: oggi l'ora, quest'anno giorno e mese, altrimenti la data completa
export function mailDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" });
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Rome" });
}
export const mailDateFull = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

export const fileSize = (n: number | null | undefined) =>
  !n ? "" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;

// Nome di file sicuro per l'archivio (resta leggibile)
export const safeFileName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-100) || "allegato";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

// Oggetto della richiesta come le vostre email: «RICHIESTA SERVIZIO - 19 NOVEMBRE - DELUCA X4»
export function orderRequestSubject(o: { service_date: string; lead_name?: string | null; pax?: string | number | null; title: string }, kind: "richiesta" | "lavoro" = "richiesta"): string {
  const [, m, d] = o.service_date.split("-").map(Number);
  const date = `${d} ${MONTHS[(m || 1) - 1]}`;
  const surname = (o.lead_name ?? "")
    .replace(/^(sig\.?\s?r?[ia]?\.?|sigg?\.|mr\.?|mrs\.?|ms\.?)\s+/i, "")
    .trim()
    .split(/\s+/)
    .pop();
  const who = surname ? ` - ${surname}${o.pax ? ` x${o.pax}` : ""}` : o.pax ? ` - x${o.pax}` : "";
  return `${kind === "richiesta" ? "Richiesta servizio" : "Servizio svolto"} - ${date}${who}`.toUpperCase().slice(0, 200);
}

// Testo della richiesta, nello stesso stile delle email che già mandate ai fornitori
export function orderRequestBody(
  o: {
    title: string;
    service_date: string;
    end_date?: string | null;
    start_time?: string | null;
    place?: string | null;
    pax?: string | number | null;
    lead_name?: string | null;
    reference?: string | null;
    details?: string | null;
    quantity: string | number;
    unit: string;
    unit_price: string | number;
    currency: string;
    free_cancel_days: string | number;
    penalty_pct: string | number;
  },
  sender: string,
  kind: "richiesta" | "lavoro" = "richiesta",
): string {
  const [y, m, d] = o.service_date.split("-").map(Number);
  const it = (iso: string) => iso.split("-").reverse().join("/");
  const q = Number(o.quantity);
  const p = Number(o.unit_price);
  const money = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = Math.round(q * p * 100) / 100;
  const freeUntil = new Date(Date.UTC(y, m - 1, d - Number(o.free_cancel_days || 0)));
  const lines = [
    "Buongiorno,",
    kind === "richiesta"
      ? `vi scrivo per richiedere il seguente servizio per il ${d} ${MONTHS[m - 1]}:`
      : `vi registro il seguente servizio svolto il ${d} ${MONTHS[m - 1]}, da confermare:`,
    "",
    o.title.toUpperCase(),
    o.lead_name ? `${o.lead_name.toUpperCase()}${o.pax ? ` (${o.pax} PAX)` : ""}` : o.pax ? `${o.pax} PAX` : "",
    `DATA: ${it(o.service_date)}${o.end_date && o.end_date !== o.service_date ? ` - ${it(o.end_date)}` : ""}${o.start_time ? ` ORE ${o.start_time.slice(0, 5)}` : ""}`,
    o.place ? `LUOGO / PICKUP: ${o.place.toUpperCase()}` : "",
    `TARIFFA: ${money(total)} ${o.currency === "EUR" ? "€" : o.currency} + IVA${q !== 1 ? ` (${q} ${o.unit} × ${money(p)})` : ""}`,
    kind === "richiesta" && Number(o.free_cancel_days) >= 0
      ? `CANCELLAZIONE: gratuita fino al ${it(freeUntil.toISOString().slice(0, 10))} compreso, poi penale del ${o.penalty_pct}%`
      : "",
    o.reference ? `RIFERIMENTO: ${o.reference}` : "",
    o.details ? `\nNOTE:\n${o.details}` : "",
    "",
    kind === "richiesta" ? "Attendo una vostra cortese conferma (potete confermare con il pulsante in alto)." : "Potete confermarlo con il pulsante in alto.",
    "",
    "Saluti",
    sender,
  ];
  return lines.filter((l, i) => l !== "" || (i > 0 && lines[i - 1] !== "")).join("\n").trim();
}
