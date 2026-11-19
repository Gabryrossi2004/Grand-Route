"use server";

import { getCachedUser } from "@/lib/supabase/server";
import { findCountryPhotos, type SheetPhoto } from "@/lib/countryPhotos";
import { ITALY_REGIONS } from "@/lib/italyLibrary";

/** 4 foto libere (Wikimedia Commons) per una regione o una zona della libreria Italia. */
export async function getItalyPhotos(region: string, zone?: string): Promise<SheetPhoto[]> {
  const user = await getCachedUser();
  if (!user || typeof region !== "string") return [];
  const r = ITALY_REGIONS[region];
  if (!r) return [];
  const z = zone ? r.zones.find((x) => x.id === zone) : undefined;
  if (zone && !z) return [];
  const places = z ? z.highlights : r.places;
  try {
    // le risposte di Wikipedia restano in cache: la seconda apertura è immediata
    return await Promise.race([
      findCountryPhotos(places.map((p) => ({ query: p.search || p.name, title: p.name }))),
      new Promise<SheetPhoto[]>((resolve) => setTimeout(() => resolve([]), 15_000)),
    ]);
  } catch {
    return [];
  }
}
