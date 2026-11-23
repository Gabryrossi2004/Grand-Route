import { librarySheet } from "@/lib/countrySheetLibrary";
import { nameItOfCode } from "@/lib/geo/countryCodes";
import { photoSrc } from "@/lib/photoSrc";
import { TRAVEL_FACTS } from "@/data/travelFacts";
import { TRAVEL_MOODS, type Mood } from "@/data/travelMoods";

// Dati per «Il tuo prossimo viaggio»: la scheda completa di una meta e la versione leggera per l'esploratore e il gioco

export type NextTripIdea = {
  code: string;
  name: string;
  because: string | null;
  tagline: string;
  photos: { src: string; title: string; credit: string }[];
  facts: string[];
  food: string[];
  experiences: string[];
  bestPeriod: string;
  flight: string;
  season: { now: boolean; text: string } | null;
  itinerary: { title: string; days: number; route: string; description: string };
};

export type DestinationLite = {
  code: string;
  name: string;
  tagline: string;
  photos: string[];
  fact: string | null;
  moods: Mood[];
  seasonNow: boolean;
};

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

// Stagione: dai calendari delle zone (12 lettere, O = ottimo) si ricava se è il momento giusto
function seasonHint(seasons: string[], month: number): { now: boolean; text: string } | null {
  const good = Array.from({ length: 12 }, (_, i) => seasons.some((s) => s[i] === "O"));
  if (!good.some(Boolean)) return null;
  if (good[month]) return { now: true, text: "Stagione perfetta adesso" };
  for (let i = 1; i < 12; i++) {
    const m = (month + i) % 12;
    if (good[m]) return { now: false, text: `Il meglio da ${MONTHS[m]}` };
  }
  return null;
}

// Le mete che si possono proporre: con atmosfere, itinerari pronti e almeno due foto
export function destinationPool(): string[] {
  return Object.keys(TRAVEL_MOODS).filter((c) => {
    const s = librarySheet(c);
    return Boolean(s?.content.itineraries?.length) && (s?.photos.length ?? 0) >= 2;
  });
}

const cleanCredit = (c: string) => c.replace(/\[\S+\s+([^\]]+)\]/g, "$1").trim();

export function destinationDetail(code: string, because: string | null = null): NextTripIdea | null {
  const sheet = librarySheet(code);
  const it = sheet?.content.itineraries?.[0];
  if (!sheet || !it) return null;
  const { content, photos } = sheet;
  return {
    code,
    name: nameItOfCode(code),
    because: because ? nameItOfCode(because) : null,
    tagline: content.tagline,
    photos: photos.slice(0, 4).map((p) => ({ src: photoSrc(p.url), title: p.title, credit: cleanCredit(p.credit) })),
    facts: TRAVEL_FACTS[code] ?? [],
    food: (content.food ?? []).slice(0, 4),
    experiences: (content.experiences ?? []).slice(0, 5).map((e) => e.name),
    bestPeriod: content.facts.bestPeriod,
    flight: content.facts.flight,
    season: seasonHint((content.areas ?? []).map((a) => a.seasons), new Date().getMonth()),
    itinerary: { title: it.title, days: it.days, route: it.route, description: it.description },
  };
}

export function destinationLite(code: string): DestinationLite | null {
  const sheet = librarySheet(code);
  if (!sheet) return null;
  const month = new Date().getMonth();
  return {
    code,
    name: nameItOfCode(code),
    tagline: sheet.content.tagline,
    photos: sheet.photos.slice(0, 3).map((p) => photoSrc(p.url, 500)),
    fact: TRAVEL_FACTS[code]?.[0] ?? null,
    moods: TRAVEL_MOODS[code] ?? [],
    seasonNow: Boolean(seasonHint((sheet.content.areas ?? []).map((a) => a.seasons), month)?.now),
  };
}
