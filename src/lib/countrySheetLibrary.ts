import europa from "@/data/countrySheets/europa.json";
import africa from "@/data/countrySheets/africa-medioriente.json";
import asia from "@/data/countrySheets/asia.json";
import americhe from "@/data/countrySheets/americhe-oceania.json";
import europa2 from "@/data/countrySheets/europa-2.json";
import europa3 from "@/data/countrySheets/europa-3.json";
import medioriente2 from "@/data/countrySheets/medioriente-asiacentrale.json";
import asia2 from "@/data/countrySheets/asia-2.json";
import africa2 from "@/data/countrySheets/africa-2.json";
import africa3 from "@/data/countrySheets/africa-3.json";
import africa4 from "@/data/countrySheets/africa-4.json";
import americhe2 from "@/data/countrySheets/americhe-2.json";
import caraibi from "@/data/countrySheets/caraibi.json";
import oceania2 from "@/data/countrySheets/oceania-2.json";
import photos from "@/data/countrySheets/photos.json";
import { COUNTRY_GUIDES } from "@/data/countryGuides";
import type { CountrySheetContent } from "@/lib/countrySheetAi";
import type { SheetPhoto } from "@/lib/countryPhotos";

// Libreria Grand Route: schede paese già pronte per le destinazioni più vendute, uguali per tutte
// le agenzie e senza costi di AI. L'agenzia può personalizzarle con Zefiro (la sua versione ha la precedenza).
export const LIBRARY_UPDATED_AT = "2026-11-23T12:00:00.000Z";

const SHEETS = { ...europa, ...africa, ...asia, ...americhe, ...europa2, ...europa3, ...medioriente2, ...asia2, ...africa2, ...africa3, ...africa4, ...americhe2, ...caraibi, ...oceania2 } as unknown as Record<string, CountrySheetContent>;
const PHOTOS = photos as unknown as Record<string, SheetPhoto[]>;

// La guida approfondita (zone e periodi, cosa fare, itinerari, consigli per l'agente, paragrafi e luoghi in più)
// si aggiunge alla scheda base del paese.
export function librarySheet(code: string): { content: CountrySheetContent; photos: SheetPhoto[] } | null {
  const base = SHEETS[code];
  if (!base) return null;
  const g = COUNTRY_GUIDES[code];
  if (!g) return { content: base, photos: PHOTOS[code] ?? [] };
  const content: CountrySheetContent = {
    ...base,
    description: [...base.description, ...(g.moreDescription ?? [])],
    places: [...base.places, ...(g.morePlaces ?? [])],
    facts: g.bestPeriod ? { ...base.facts, bestPeriod: g.bestPeriod } : base.facts,
    areas: g.areas,
    experiences: g.experiences,
    itineraries: g.itineraries,
    agentTips: g.agentTips,
  };
  return { content, photos: PHOTOS[code] ?? [] };
}

export const LIBRARY_CODES = Object.keys(SHEETS);
