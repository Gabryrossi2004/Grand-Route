"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext, getTeamPeople } from "@/lib/team";

// «Lo segue»: assegna il viaggio a una persona della squadra (o a nessuno)
export async function assignTrip(tripId: string, userId: string | null): Promise<{ ok: true } | { error: string }> {
  const team = await getTeamContext();
  if (!team) return { error: "Sessione scaduta: accedi di nuovo." };
  if (userId) {
    const people = await getTeamPeople();
    if (!people.some((p) => p.id === userId)) return { error: "Questa persona non fa parte della squadra." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trips")
    .update({ assigned_to: userId })
    .eq("id", tripId)
    .eq("owner_id", team.companyId)
    .select("id");
  if (error) return { error: /assigned_to/.test(error.message) ? "Serve l'aggiornamento del database (migrazione 0075)." : "Non salvato. Riprova." };
  if (!data || data.length === 0) return { error: "Viaggio non trovato." };
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard/trips");
  return { ok: true };
}
