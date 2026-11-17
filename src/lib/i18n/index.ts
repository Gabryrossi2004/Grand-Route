import { entries, type TKey } from "./dictionary";

export type { TKey };
export type Lang = "it" | "en";
// Interruttore generale: per ora il sito è solo in italiano (l'inglese è pronto ma nascosto).
// Per riattivarlo: metti true.
export const LANGUAGE_SWITCH_ENABLED = false;

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "it", label: "Italiano", short: "IT" },
  { code: "en", label: "English", short: "EN" },
];
export const LANG_COOKIE = "gr_lang";

export function normalizeLang(value: unknown): Lang | null {
  return value === "it" || value === "en" ? value : null;
}

// Senza una scelta salvata si segue la lingua del browser: italiano per chi ha
// il browser in italiano, inglese per tutti gli altri.
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  const first = String(header ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "it";
  return first.startsWith("it") ? "it" : "en";
}

export function localeFor(lang: Lang) {
  return lang === "en" ? "en-GB" : "it-IT";
}

export type Vars = Record<string, string | number | null | undefined>;

export function translate(lang: Lang, key: TKey, vars?: Vars): string {
  const entry = entries[key];
  const text: string = (entry?.[lang] ?? entry?.it ?? key) as string;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

// Le etichette dei tipi di attività (Volo, Alloggio...) nella lingua scelta
export function activityLabel(lang: Lang, type: string, fallback: string): string {
  const key = `activity.${type}` as TKey;
  return key in entries ? translate(lang, key) : fallback;
}

// Etichette dei campi di dettaglio delle attività (compagnia, numero volo...)
const DETAIL_EN: Record<string, string> = {
  compagnia: "Company",
  numero_volo: "Flight number",
  pnr: "Booking reference",
  aeroporto_partenza: "Departure airport",
  aeroporto_arrivo: "Arrival airport",
  orario_arrivo: "Arrival time",
  tipo_camera: "Room type",
  trattamento: "Board",
  check_in: "Check-in time",
  check_out: "Check-out time",
  data_check_out: "Check-out date",
  numero_conferma: "Confirmation number",
  fornitore: "Company / Driver",
  luogo_arrivo: "Arrival place",
  numero_treno: "Train number",
  carrozza_posto: "Coach / Seat",
  stazione_arrivo: "Arrival station",
  numero_corsa: "Crossing number",
  porto_arrivo: "Arrival port",
  nome_nave: "Ship name",
  numero_cabina: "Cabin number",
  porto_partenza: "Departure port",
  numero_persone: "Number of people",
  note_prenotazione: "Booking notes",
  punto_incontro: "Meeting point",
  durata: "Duration",
};
const DETAIL_EN_BY_TYPE: Record<string, string> = {
  "volo.compagnia": "Airline",
  "treno.compagnia": "Train operator",
  "traghetto.compagnia": "Ferry company",
  "crociera.compagnia": "Cruise line",
};
export function detailLabel(lang: Lang, type: string, key: string, fallback: string): string {
  if (lang !== "en") return fallback;
  return DETAIL_EN_BY_TYPE[`${type}.${key}`] ?? DETAIL_EN[key] ?? fallback;
}
