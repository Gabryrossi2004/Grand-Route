"use server";

import { createClient } from "@/lib/supabase/server";
import { generateTranslation } from "@/lib/tripTranslation";
import type { Activity, Trip, TripDay } from "@/lib/types";

// Traduce in inglese l'itinerario di un viaggio (solo per chi è collegato al
// viaggio: lo garantisce il database al momento del salvataggio).
export async function translateTripForReader(tripId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "session" };

  // RLS: si vede il viaggio solo se è dell'agenzia o del cliente collegato
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (!trip) return { error: "notfound" };
  const { data: dayRows } = await supabase
    .from("trip_days")
    .select("*, activities(*)")
    .eq("trip_id", tripId)
    .order("day_order", { ascending: true });
  const days = ((dayRows as (TripDay & { activities: Activity[] })[]) ?? []).map((d) => ({
    ...d,
    activities: [...(d.activities ?? [])].sort((a, b) => a.activity_order - b.activity_order),
  }));
  try {
    return await generateTranslation(supabase, trip as Trip, days);
  } catch (error) {
    console.error("[translateTripForReader]", (error as Error).message);
    return { error: `ai: ${(error as Error).message}`.slice(0, 300) };
  }
}
