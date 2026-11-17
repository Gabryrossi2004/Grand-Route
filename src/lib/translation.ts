import type { Activity, Trip, TripDay } from "@/lib/types";

// Traduzione di un viaggio: si raccolgono i testi da tradurre (titoli,
// descrizioni, alcune note), si dividono in blocchi e si rimettono al loro
// posto nella copia. Codici, orari, numeri di volo e nomi di luogo restano
// com'erano.
export const TRANSLATION_LANGUAGES: { code: string; name: string; english: string }[] = [
  { code: "en", name: "Inglese", english: "English" },
  { code: "fr", name: "Francese", english: "French" },
  { code: "de", name: "Tedesco", english: "German" },
  { code: "es", name: "Spagnolo", english: "Spanish" },
  { code: "pt", name: "Portoghese", english: "Portuguese" },
  { code: "nl", name: "Olandese", english: "Dutch" },
  { code: "ru", name: "Russo", english: "Russian" },
  { code: "zh", name: "Cinese (semplificato)", english: "Simplified Chinese" },
  { code: "ja", name: "Giapponese", english: "Japanese" },
  { code: "ar", name: "Arabo", english: "Arabic" },
];

// Dettagli delle attività che sono testo libero (gli altri sono codici, orari,
// nomi propri o scelte da elenco e non si toccano).
export const TRANSLATABLE_DETAIL_KEYS = ["tipo_camera", "note_prenotazione", "punto_incontro", "durata"];

export type TranslationItem = { id: string; text: string };
type DayWithActivities = TripDay & { activities: Activity[] };

const clean = (value: string | null | undefined) => String(value ?? "").trim();

export function collectItems(
  trip: Pick<Trip, "title" | "destination" | "rate_includes" | "rate_excludes">,
  days: DayWithActivities[],
): TranslationItem[] {
  const items: TranslationItem[] = [];
  const add = (id: string, text: string | null | undefined) => {
    if (clean(text)) items.push({ id, text: clean(text) });
  };
  add("t.title", trip.title);
  add("t.destination", trip.destination);
  add("t.rate_includes", trip.rate_includes);
  add("t.rate_excludes", trip.rate_excludes);
  days.forEach((day, d) => {
    add(`d${d}.title`, day.title);
    (day.activities ?? []).forEach((activity, a) => {
      add(`d${d}a${a}.title`, activity.title);
      add(`d${d}a${a}.desc`, activity.description);
      for (const key of TRANSLATABLE_DETAIL_KEYS) {
        const value = (activity.details as Record<string, string> | null)?.[key];
        add(`d${d}a${a}.k.${key}`, value);
      }
    });
  });
  return items;
}

// Blocchi di dimensione contenuta: ogni richiesta resta rapida e un viaggio
// lungo si traduce in parallelo.
export function chunkItems(items: TranslationItem[], maxChars = 6000): TranslationItem[][] {
  const chunks: TranslationItem[][] = [];
  let current: TranslationItem[] = [];
  let size = 0;
  for (const item of items) {
    if (current.length > 0 && size + item.text.length > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += item.text.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// Traduce tutti i blocchi (in parallelo) e restituisce id → testo tradotto.
// Se un blocco manca o è incompleto, per quegli id resta il testo originale.
export async function runTranslation(
  items: TranslationItem[],
  translateChunk: (chunk: TranslationItem[]) => Promise<TranslationItem[]>,
): Promise<{ translated: Map<string, string>; missing: number }> {
  const translated = new Map<string, string>();
  const results = await Promise.all(chunkItems(items).map((chunk) => translateChunk(chunk).catch(() => [] as TranslationItem[])));
  for (const result of results) {
    for (const item of result) if (clean(item.text)) translated.set(item.id, item.text.trim());
  }
  const missing = items.filter((item) => !translated.has(item.id)).length;
  return { translated, missing };
}

export const pick = (map: Map<string, string>, id: string, fallback: string | null | undefined) =>
  map.get(id) ?? (fallback ?? null);
