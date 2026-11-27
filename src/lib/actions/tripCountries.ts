"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { companyIdOf } from "@/lib/team";

// Paesi del viaggio scelti a mano dall'agenzia (si aggiungono a quelli ricavati dall'itinerario)
export async function setTripCountries(tripId: string, codes: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.array(z.string().regex(/^[A-Z]{2}$/)).max(40).safeParse(codes);
  const user = await getCachedUser();
  if (!user || !parsed.success || !z.string().uuid().safeParse(tripId).success) return { ok: false, error: "Dati non validi." };
  const companyId = await companyIdOf(user.id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ countries: [...new Set(parsed.data)] })
    .eq("id", tripId)
    .eq("owner_id", companyId);
  if (error) return { ok: false, error: "Non sono riuscito a salvare. Serve l'aggiornamento del database (SQL 0045)?" };
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard/mappamondo");
  return { ok: true };
}
