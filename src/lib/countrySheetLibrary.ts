import europa from "@/data/countrySheets/europa.json";
import africa from "@/data/countrySheets/africa-medioriente.json";
import asia from "@/data/countrySheets/asia.json";
import americhe from "@/data/countrySheets/americhe-oceania.json";
import photos from "@/data/countrySheets/photos.json";
import type { CountrySheetContent } from "@/lib/countrySheetAi";
import type { SheetPhoto } from "@/lib/countryPhotos";

// Libreria Grand Route: schede paese già pronte per le destinazioni più vendute, uguali per tutte
// le agenzie e senza costi di AI. L'agenzia può personalizzarle con Zefiro (la sua versione ha la precedenza).
export const LIBRARY_UPDATED_AT = "2026-11-19T12:00:00.000Z";

const SHEETS = { ...europa, ...africa, ...asia, ...americhe } as unknown as Record<string, CountrySheetContent>;
const PHOTOS = photos as unknown as Record<string, SheetPhoto[]>;

export function librarySheet(code: string): { content: CountrySheetContent; photos: SheetPhoto[] } | null {
  const content = SHEETS[code];
  if (!content) return null;
  return { content, photos: PHOTOS[code] ?? [] };
}

export const LIBRARY_CODES = Object.keys(SHEETS);
