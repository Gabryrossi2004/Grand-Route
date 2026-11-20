// L'«archivio» di Zefiro: risposte immediate e gratuite (nessuna AI) a partire dai dati già presenti
// in Grand Route — il viaggio del cliente, le schede paese della libreria, le domande frequenti
// dell'agenzia e le risposte già date. Se qui non si trova nulla di sicuro, la domanda passa all'AI.
// Le regole sono volutamente prudenti: meglio passare all'AI che rispondere a una domanda diversa.

import { CHECK_OUT_DATE_KEY } from "@/lib/activityTypes";
import { librarySheet } from "@/lib/countrySheetLibrary";
import type { Activity, Trip, TripDay, TripPayment } from "@/lib/types";
import type { ZefiroTopicId } from "@/lib/zefiroTopics";

export type LocalSource = "viaggio" | "paese" | "faq" | "memoria";
export type LocalAnswer = { answer: string; source: LocalSource };

type DayWithActivities = TripDay & { activities: Activity[] };

// ── Testo ────────────────────────────────────────────────────────────────────
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "il lo la i gli le un uno una di del della dello dei degli delle a al alla allo ai agli alle da dal dalla dai in nel nella nei negli nelle con su sul sulla per tra fra e ed o od ma che chi cosa come dove quando quanto quanti quanta quante quale quali se non si mi ti ci vi ne lo sono sei siamo siete e' ho hai ha abbiamo avete hanno c'e ce ci c'e' posso puoi puo possiamo potete devo devi deve dobbiamo dovete anche gia piu molto poi qui li la' questo questa questi queste quello quella mio mia miei mie tuo tua suo sua nostro nostra vostro vostra loro bisogna serve servono fare essere avere grazie ciao buongiorno salve scusa scusi per favore".split(
    " ",
  ),
);

export function keywords(text: string): string[] {
  return normalize(text)
    .replace(/'/g, " ")
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, w.length - 1) : w)); // singolare/plurale: "voli" ~ "volo"
}

// Somiglianza tra due domande (0-1): parole importanti in comune.
export function similarity(a: string, b: string): number {
  const A = new Set(keywords(a));
  const B = new Set(keywords(b));
  if (A.size === 0 || B.size === 0) return 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  if (common < Math.min(2, Math.min(A.size, B.size))) return 0;
  return (2 * common) / (A.size + B.size);
}

// ── Date ─────────────────────────────────────────────────────────────────────
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function longDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
function whichDay(q: string, today: string): { iso: string; label: string } | null {
  if (/\bdopodomani\b/.test(q)) return { iso: addDays(today, 2), label: "dopodomani" };
  if (/\bdomani\b/.test(q)) return { iso: addDays(today, 1), label: "domani" };
  if (/\b(oggi|stasera|stanotte|stamattina|questa sera|questa notte|stamani)\b/.test(q)) return { iso: today, label: "oggi" };
  return null;
}

// ── Il viaggio ───────────────────────────────────────────────────────────────
const ordered = (days: DayWithActivities[]) => [...days].sort((a, b) => a.day_order - b.day_order);
const sortedActs = (d: DayWithActivities) => [...(d.activities ?? [])].sort((a, b) => a.activity_order - b.activity_order);

function activityLine(a: Activity): string {
  const time = hhmm(a.start_time);
  const where = a.location ? ` (${a.location})` : "";
  return `• ${time ? `${time} – ` : ""}${a.title}${where}`;
}

function dayProgram(days: DayWithActivities[], day: { iso: string; label: string }): string | null {
  const found = ordered(days).find((d) => d.day_date?.slice(0, 10) === day.iso);
  if (!found) {
    return null;
  }
  const acts = sortedActs(found).filter((a) => a.activity_type !== "info");
  const head = `Il programma di ${day.label} (${longDate(day.iso)})${found.title ? `: ${found.title}` : ""}.`;
  if (acts.length === 0) return `${head}\nÈ una giornata libera, senza attività in programma.`;
  return `${head}\n${acts.map(activityLine).join("\n")}`;
}

function whereSleep(days: DayWithActivities[], day: { iso: string; label: string }): string | null {
  const list = ordered(days);
  const idx = list.findIndex((d) => d.day_date?.slice(0, 10) === day.iso);
  if (idx < 0) return null;
  for (let i = idx; i >= 0; i--) {
    const stay = sortedActs(list[i]).find((a) => a.activity_type === "alloggio");
    if (!stay) continue;
    // check-out il giorno chiesto o prima: quell'alloggio non vale più per quella notte
    const checkOut = String(stay.details?.[CHECK_OUT_DATE_KEY] ?? "").slice(0, 10);
    if (checkOut && checkOut <= day.iso) return null;
    const d = stay.details ?? {};
    const extra = [
      d.check_in && i === idx ? `check-in dalle ${hhmm(String(d.check_in))}` : "",
      d.trattamento ? `trattamento: ${d.trattamento}` : "",
      d.numero_conferma ? `conferma n. ${d.numero_conferma}` : "",
    ].filter(Boolean);
    return `${day.label === "oggi" ? "Stanotte" : day.label === "domani" ? "Domani notte" : "Dopodomani notte"} dormi a: ${stay.title}${stay.location ? `, ${stay.location}` : ""}.${extra.length ? `\n${extra.join(" · ")}` : ""}`;
  }
  return null;
}

function flights(days: DayWithActivities[], today: string): string | null {
  const rows: string[] = [];
  for (const d of ordered(days)) {
    const date = d.day_date?.slice(0, 10);
    if (date && date < today) continue;
    for (const a of sortedActs(d)) {
      if (a.activity_type !== "volo") continue;
      const det = a.details ?? {};
      const parts = [
        date ? longDate(date) : "",
        a.start_time ? `partenza ${hhmm(a.start_time)}` : "",
        det.orario_arrivo ? `arrivo ${hhmm(String(det.orario_arrivo))}` : "",
      ].filter(Boolean);
      const num = [det.compagnia, det.numero_volo].filter(Boolean).join(" ");
      rows.push(`• ${a.title}${num ? ` (${num})` : ""}${parts.length ? ` — ${parts.join(", ")}` : ""}${det.scalo ? `\n  Scalo: ${det.scalo}` : ""}`);
      if (rows.length >= 4) break;
    }
  }
  if (rows.length === 0) return null;
  return `${rows.length === 1 ? "Il tuo prossimo volo" : "I tuoi prossimi voli"}:\n${rows.join("\n")}`;
}

function paymentsAnswer(payments: TripPayment[]): string | null {
  const incassi = payments.filter((p) => p.direction === "incasso");
  if (incassi.length === 0) return null;
  const open = incassi.filter((p) => !p.paid_date).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  if (open.length === 0) return "Risultano saldati tutti i pagamenti del viaggio. Grazie!";
  const total = open.reduce((s, p) => s + Number(p.amount || 0), 0);
  const lines = open.map((p) => `• € ${Number(p.amount).toFixed(2)}${p.due_date ? ` entro ${longDate(p.due_date)}` : ""}`);
  return `Restano da pagare € ${total.toFixed(2)}:\n${lines.join("\n")}`;
}

function tripDates(trip: Trip, q: string): string | null {
  if (/\b(quando|che giorno|data)\b.*\b(parto|partiamo|si parte|partenza)\b/.test(q) && trip.start_date) return `La partenza è ${longDate(trip.start_date)}.`;
  if (/\b(quando|che giorno|data)\b.*\b(torno|torniamo|rientro|rientriamo|ritorno|si torna)\b/.test(q) && trip.end_date) return `Il rientro è ${longDate(trip.end_date)}.`;
  return null;
}

export function answerFromTrip(
  question: string,
  ctx: { trip: Trip; days: DayWithActivities[]; payments: TripPayment[]; today: string; agencyPhone: string | null; agencyName: string },
): string | null {
  const q = normalize(question);
  if (q.length > 160) return null;

  const dates = tripDates(ctx.trip, q);
  if (dates) return dates;

  if (/\b(emergenz|urgent|reperibil|numero (di )?(telefono|assistenza|emergenza)|chi (chiamo|contatto|posso chiamare))/.test(q)) {
    return ctx.agencyPhone
      ? `Per un'emergenza puoi chiamare ${ctx.agencyName} al numero ${ctx.agencyPhone}. In caso di pericolo immediato chiama i numeri di emergenza locali.`
      : null;
  }

  if (/\b(pagar|pagament|saldo|saldare|acconto|rata|rate|versare|bonifico|devo ancora)/.test(q) && !/\b(come|dove|con cosa|carta|contanti)\b/.test(q)) {
    return paymentsAnswer(ctx.payments);
  }

  if (/\b(volo|voli|aereo|imbarco)\b/.test(q) && /\b(quando|che ora|orario|ora|numero|parte|partenza|mio|nostro|prossimo)\b/.test(q)) {
    return flights(ctx.days, ctx.today);
  }

  const day = whichDay(q, ctx.today);
  if (/\b(dove (dormo|dormiamo|alloggio|alloggiamo|pernotto|pernottiamo|sto|stiamo)|quale (hotel|albergo)|che (hotel|albergo)|il (mio|nostro) (hotel|albergo))/.test(q)) {
    return whereSleep(ctx.days, day ?? { iso: ctx.today, label: "oggi" });
  }

  if (day && /\b(programma|cosa (faccio|facciamo|si fa|c'e|ce|abbiamo|ho|e previsto)|che (cosa )?(faccio|facciamo|abbiamo)|attivita|escursion|cosa prevede|com'e la giornata|piano)\b/.test(q)) {
    return dayProgram(ctx.days, day);
  }

  return null;
}

// ── Il paese (libreria Grand Route) ─────────────────────────────────────────
type CountryIntent = { id: string; topic: Exclude<ZefiroTopicId, "viaggio" | "servizi">; test: RegExp };
const COUNTRY_INTENTS: CountryIntent[] = [
  { id: "documenti", topic: "paese", test: /\b(document|passaport|visto|visti|carta d'identita|carta di identita|esta|eta|e-visa|evisa|ingresso nel paese|serve il visto)/ },
  { id: "moneta", topic: "paese", test: /\b(moneta|valuta|soldi|contanti|cambio|cambiare i soldi|bancomat|carta di credito|carte di credito|si paga con)/ },
  { id: "fuso", topic: "paese", test: /\b(fuso|differenza (di )?or|che ora e|ora locale|orario locale|quante ore)/ },
  { id: "prese", topic: "paese", test: /\b(prese|presa|spina|adattator|corrente|voltaggio|caricabatter)/ },
  { id: "mance", topic: "paese", test: /\b(mance|mancia)\b/ },
  { id: "lingua", topic: "paese", test: /\b(che lingua|lingua si parla|lingue|parlano|si parla inglese)/ },
  { id: "clima", topic: "paese", test: /\b(clima|che tempo|temperatur|pioggia|piove|stagione|periodo migliore|quando conviene|quando andare)/ },
  { id: "cucina", topic: "consigli", test: /\b(cosa si mangia|cosa mangiare|cucina|piatti|piatto tipico|cibo|specialita|da assaggiare)/ },
  { id: "vedere", topic: "consigli", test: /\b(cosa (c'e da )?vedere|da visitare|da non perdere|posti (piu )?belli|luoghi da)/ },
  { id: "trasporti", topic: "trasporti", test: /\b(come (ci si )?(muov|spost)|spostarsi|mezzi|trasporti|taxi|metro|metropolitana|noleggi|guidare|si guida)/ },
];

function countryIntent(q: string): CountryIntent | null {
  const hits = COUNTRY_INTENTS.filter((i) => i.test.test(q));
  return hits.length === 1 ? hits[0] : null; // domanda ambigua (più argomenti): meglio l'AI
}

const regionName = new Intl.DisplayNames(["it"], { type: "region" });

function countryPart(code: string, intent: string): string | null {
  const sheet = librarySheet(code)?.content;
  if (!sheet) return null;
  const f = sheet.facts;
  switch (intent) {
    case "documenti":
      return `${f.documents} Prima della partenza conviene sempre verificare gli aggiornamenti su viaggiaresicuri.it.`;
    case "moneta":
      return [f.currency, ...sheet.tips.filter((t) => /contant|carta|bancomat|cambi|moneta|valuta/i.test(t)).slice(0, 2)].join(" ");
    case "fuso":
      return f.timezone;
    case "prese":
      return f.plugs;
    case "mance": {
      const tip = sheet.tips.find((t) => /manc/i.test(t)) ?? sheet.agentTips?.find((t) => /manc/i.test(t));
      return tip ?? null;
    }
    case "lingua":
      return f.languages;
    case "clima":
      return `${f.climate} Periodo migliore: ${f.bestPeriod}.`;
    case "cucina":
      return sheet.food.length ? `Da assaggiare:\n${sheet.food.slice(0, 6).map((x) => `• ${x}`).join("\n")}` : null;
    case "vedere":
      return sheet.places.length ? `Da non perdere:\n${sheet.places.slice(0, 6).map((p) => `• ${p.name}: ${p.description}`).join("\n")}` : null;
    case "trasporti":
      return sheet.gettingAround.length ? sheet.gettingAround.slice(0, 4).map((x) => `• ${x}`).join("\n") : null;
  }
  return null;
}

export function answerFromCountries(question: string, codes: string[], topics?: ZefiroTopicId[]): string | null {
  const q = normalize(question);
  if (q.length > 160 || codes.length === 0) return null;
  const intent = countryIntent(q);
  if (!intent) return null;
  if (topics && !topics.includes(intent.topic)) return null;
  const parts = codes
    .slice(0, 3)
    .map((c) => ({ c, text: countryPart(c, intent.id) }))
    .filter((p): p is { c: string; text: string } => !!p.text);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].text;
  return parts.map((p) => `${regionName.of(p.c) ?? p.c}: ${p.text}`).join("\n\n");
}

// ── Domande frequenti dell'agenzia e risposte già date ──────────────────────
export type FaqItem = { question: string; answer: string };

export function bestMatch<T extends FaqItem>(question: string, items: T[], threshold: number): T | null {
  let best: T | null = null;
  let score = 0;
  for (const item of items) {
    const s = similarity(question, item.question);
    if (s > score) {
      score = s;
      best = item;
    }
  }
  return score >= threshold ? best : null;
}

// Tutto in un passaggio: viaggio → FAQ dell'agenzia → schede paese → risposte già date
export function localAnswer(
  question: string,
  ctx: {
    trip: Trip;
    days: DayWithActivities[];
    payments: TripPayment[];
    today: string;
    agencyPhone: string | null;
    agencyName: string;
    topics: ZefiroTopicId[];
    countries: string[];
    faqs: FaqItem[];
    memory: FaqItem[];
  },
): LocalAnswer | null {
  const fromTrip = answerFromTrip(question, ctx);
  if (fromTrip) return { answer: fromTrip, source: "viaggio" };
  const faq = bestMatch(question, ctx.faqs, 0.6);
  if (faq) return { answer: faq.answer, source: "faq" };
  const fromCountry = answerFromCountries(question, ctx.countries, ctx.topics);
  if (fromCountry) return { answer: fromCountry, source: "paese" };
  const remembered = bestMatch(question, ctx.memory, 0.75);
  if (remembered) return { answer: remembered.answer, source: "memoria" };
  return null;
}
