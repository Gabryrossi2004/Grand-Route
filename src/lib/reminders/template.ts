// Email di riconferma del fornitore all'agenzia (o tour operator): UNA sola email in blocco con tutti i servizi dei
// prossimi giorni, già scritta e modificabile. Qui c'è solo la parte di testo (usata sia dal sito sia dall'invio automatico).

export type ReminderService = {
  id: string;
  date: string;
  time: string | null;
  title: string;
  place: string | null;
  pax: number | null;
  lead_name: string | null;
  reference: string | null;
  quantity: number;
  unit: string;
  amount: number;
  currency: string;
};

export type ReminderTemplate = { subject?: string | null; intro?: string | null; outro?: string | null };
export type ReminderContext = { seller: string; buyer: string; today: string };

// Testi standard (il fornitore può personalizzarli). Segnaposto: {agenzia} {fornitore} {quando} {giorni}
export const DEFAULT_SUBJECT = "Riconferma servizi {giorni} – {fornitore}";
export const DEFAULT_INTRO = "Buonasera {agenzia},\nqui {fornitore}: questi sono i servizi che abbiamo in programma {quando}. Ci confermi che è tutto ancora valido?";
export const DEFAULT_OUTRO = "Per riconfermare basta rispondere a questa email (arriva direttamente a {fornitore}) oppure scrivere su Grand Route. Se qualcosa è cambiato, dicci subito.\n\nGrazie,\n{fornitore}";
export const PLACEHOLDERS = ["{agenzia}", "{fornitore}", "{quando}", "{giorni}"] as const;

const addDay = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dayShort = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", timeZone: "UTC" });
const money = (n: number, c: string) => {
  try {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c}`;
  }
};
const join = (parts: string[]) => (parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`);

export function fillTemplate(text: string, ctx: ReminderContext, services: Pick<ReminderService, "date">[]): string {
  const days = [...new Set(services.map((s) => s.date))].sort();
  const tomorrow = addDay(ctx.today, 1);
  const quando = days.length === 1 ? (days[0] === tomorrow ? `di domani, ${dayName(days[0])}` : `di ${dayName(days[0])}`) : `di ${join(days.map(dayShort))}`;
  const giorni = days.length === 1 && days[0] === tomorrow ? "di domani" : days.length === 1 ? `del ${dayShort(days[0])}` : "dei prossimi giorni";
  return text.replaceAll("{agenzia}", ctx.buyer).replaceAll("{fornitore}", ctx.seller).replaceAll("{quando}", quando).replaceAll("{giorni}", giorni);
}

// Elenco dei servizi, giorno per giorno e in ordine di orario
export function servicesBlock(services: ReminderService[]): string {
  const days = [...new Set(services.map((s) => s.date))].sort();
  return days
    .map((d) => {
      const lines = services
        .filter((s) => s.date === d)
        .map((s) => {
          const head = [s.time ? `ore ${s.time}` : "orario da definire", s.title].join(" – ");
          const extra = [s.place, s.pax ? `${s.pax} ${s.pax === 1 ? "persona" : "persone"}` : null, s.lead_name ? `rif. ${s.lead_name}` : s.reference ? `rif. ${s.reference}` : null].filter(Boolean).join(" · ");
          return `• ${head}${extra ? `\n  ${extra}` : ""}\n  ${money(s.amount, s.currency)} + IVA`;
        })
        .join("\n");
      return `${dayName(d).toUpperCase()}\n${lines}`;
    })
    .join("\n\n");
}

// Oggetto e testo completo (apertura + elenco + chiusura): è la bozza che il fornitore può modificare
export function buildReminder(ctx: ReminderContext, services: ReminderService[], tpl: ReminderTemplate = {}) {
  const f = (t: string) => fillTemplate(t, ctx, services);
  const subject = f(tpl.subject?.trim() || DEFAULT_SUBJECT);
  const intro = f(tpl.intro?.trim() || DEFAULT_INTRO);
  const outro = f(tpl.outro?.trim() || DEFAULT_OUTRO);
  const block = servicesBlock(services);
  return { subject, intro, block, outro, body: `${intro}\n\n${block}\n\n${outro}` };
}

const esc = (t: string) => t.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string);

// Il testo (anche se modificato a mano) in una email semplice e leggibile
export function bodyToHtml(body: string, link?: { url: string; label: string }): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = link ? `<p style="margin:18px 0 0"><a href="${link.url}" style="display:inline-block;background:#233c5e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${esc(link.label)}</a></p>` : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937">${paragraphs}${button}</div>`;
}
