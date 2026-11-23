"use server";

import { z } from "zod";
import { destinationDetail, type NextTripIdea } from "@/lib/nextTripData";

// Scheda completa di una meta, chiesta quando il cliente apre una meta dall'esploratore (solo dati della libreria)
export async function getDestinationDetail(code: string): Promise<NextTripIdea | null> {
  if (!z.string().regex(/^[A-Z]{2}$/).safeParse(code).success) return null;
  return destinationDetail(code);
}
