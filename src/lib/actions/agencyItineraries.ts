"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { GeneratedItinerarySchema, type GeneratedItinerary } from "@/lib/itineraryAi";
import { countryOptions } from "@/lib/geo/countryCodes";

// Itinerari scritti dall'agenzia e salvati in Libreria per un paese o una regione italiana.
// Compaiono nella scheda paese/regione dell'Atlante e in «Consulta proposte» di Zefiro.

export type AgencyItinerary = {
  id: string;
  kind: "country" | "italy";
  place_key: string;
  place_label: string;
  title: string;
  route: string | null;
  description: string | null;
  days: number;
  program: GeneratedItinerary;
  source_trip_id: string | null;
  created_at: string;
};

export type DestinationOption = { kind: "country" | "italy"; key: string; label: string };

const NOT_READY = "Per salvare i vostri itinerari serve l'aggiornamento del database (migrazione 0056).";
const COLUMNS = "id, kind, place_key, place_label, title, route, description, days, program, source_trip_id, created_at";

// Paesi e regioni italiane tra cui scegliere (le regioni prima, poi i paesi in ordine alfabetico)
export async function destinationOptions(): Promise<DestinationOption[]> {
  const { ITALY_REGIONS, ITALY_ORDER } = await import("@/lib/italyLibrary");
  const regions = (ITALY_ORDER as string[])
    .filter((id) => ITALY_REGIONS[id])
    .map((id) => ({ kind: "italy" as const, key: id, label: ITALY_REGIONS[id].name }));
  const countries = countryOptions()
    .filter((c) => c.code !== "IT")
    .map((c) => ({ kind: "country" as const, key: c.code, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "it"));
  return [...regions, ...countries];
}

export async function listAgencyItineraries(
  filter?: { kind: "country" | "italy"; key: string },
): Promise<{ ok: true; items: AgencyItinerary[] } | { ok: false; error: string; notReady?: boolean }> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const supabase = await createClient();
  let query = supabase.from("agency_itineraries").select(COLUMNS).eq("owner_id", user.id).order("created_at", { ascending: false }).limit(300);
  if (filter) query = query.eq("kind", filter.kind).eq("place_key", filter.key);
  const { data, error } = await query;
  if (error) {
    const notReady = error.code === "42P01" || error.code === "PGRST205";
    return { ok: false, error: notReady ? NOT_READY : "Non sono riuscito a leggere gli itinerari. Riprova.", notReady };
  }
  return { ok: true, items: (data ?? []) as AgencyItinerary[] };
}

// Il percorso si ricava dagli alloggi (o, se mancano, dai titoli dei giorni): «Amman (1) → Petra (2)»
function routeFromProgram(program: GeneratedItinerary): string {
  const stops: { name: string; nights: number }[] = [];
  const days = [...program.days].sort((a, b) => a.day_index - b.day_index);
  days.forEach((day, i) => {
    if (i === days.length - 1 && days.length > 1) return; // l'ultimo giorno è la partenza
    const stay = day.activities.find((a) => a.activity_type === "alloggio" && (a.location || a.title));
    const raw = (stay?.location || day.title || "").replace(/^(arrivo a|arrivo|partenza da|trasferimento a)\s+/i, "").split(/[,–—-]/)[0].trim();
    if (!raw) return;
    const last = stops[stops.length - 1];
    if (last && last.name.toLowerCase() === raw.toLowerCase()) last.nights += 1;
    else stops.push({ name: raw.slice(0, 60), nights: 1 });
  });
  return stops
    .slice(0, 12)
    .map((s) => `${s.name} (${s.nights})`)
    .join(" → ");
}

const SaveFromTripInput = z.object({
  tripId: z.string().uuid(),
  kind: z.enum(["country", "italy"]),
  key: z.string().trim().min(2).max(40),
  label: z.string().trim().min(1).max(80),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  route: z.string().trim().max(600).optional(),
});

// «Salva come proposta»: il programma del viaggio (giorni e attività) diventa un itinerario della Libreria
export async function saveTripAsItinerary(input: z.input<typeof SaveFromTripInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = SaveFromTripInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Controlla destinazione e titolo." };
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const { tripId, kind, key, label, title, description, route } = parsed.data;
  const supabase = await createClient();

  const { data: trip } = await supabase.from("trips").select("id").eq("id", tripId).eq("owner_id", user.id).maybeSingle();
  if (!trip) return { ok: false, error: "Viaggio non trovato." };
  const { data: days } = await supabase.from("trip_days").select("id, day_order, title").eq("trip_id", tripId).order("day_order");
  if (!days || days.length === 0) return { ok: false, error: "Questo viaggio non ha ancora giorni da salvare." };
  const { data: acts } = await supabase
    .from("activities")
    .select("trip_day_id, title, description, location, activity_type, details, start_time, activity_order")
    .in(
      "trip_day_id",
      days.map((d) => d.id as string),
    )
    .order("activity_order");

  const program: GeneratedItinerary = {
    days: days.slice(0, 60).map((d, i) => ({
      day_index: i,
      title: (d.title as string | null) || null,
      activities: (acts ?? [])
        .filter((a) => a.trip_day_id === d.id)
        .slice(0, 30)
        .map((a) => ({
          activity_type: a.activity_type,
          title: String(a.title ?? "Attività").slice(0, 300),
          start_time: (a.start_time as string | null)?.slice(0, 5) || null,
          description: (a.description as string | null)?.slice(0, 6000) || null,
          location: (a.location as string | null)?.slice(0, 300) || null,
          details: Object.fromEntries(
            Object.entries((a.details as Record<string, unknown>) ?? {}).filter(([, v]) => typeof v === "string" && v.trim()),
          ) as Record<string, string>,
        })),
    })),
    agent_notes: [],
    questions: [],
  };
  const checked = GeneratedItinerarySchema.safeParse(program);
  if (!checked.success) return { ok: false, error: "Il programma di questo viaggio non si può salvare così com'è." };

  const { error } = await supabase.from("agency_itineraries").insert({
    owner_id: user.id,
    kind,
    place_key: key,
    place_label: label,
    title,
    route: (route || routeFromProgram(checked.data)).slice(0, 600) || null,
    description: description || null,
    days: checked.data.days.length,
    program: checked.data,
    source_trip_id: tripId,
  });
  if (error) {
    return { ok: false, error: error.code === "42P01" || error.code === "PGRST205" ? NOT_READY : "Non sono riuscito a salvare. Riprova." };
  }
  revalidatePath("/dashboard/library");
  return { ok: true };
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000),
  route: z.string().trim().max(600),
});

export async function updateAgencyItinerary(input: z.input<typeof UpdateInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = UpdateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Il titolo deve avere almeno 2 caratteri." };
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("agency_itineraries")
    .update({ title: parsed.data.title, description: parsed.data.description || null, route: parsed.data.route || null })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: "Non sono riuscito a salvare. Riprova." };
  revalidatePath("/dashboard/library");
  return { ok: true };
}

export async function deleteAgencyItinerary(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Itinerario non valido." };
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const supabase = await createClient();
  const { error } = await supabase.from("agency_itineraries").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, error: "Non sono riuscito a eliminarlo. Riprova." };
  revalidatePath("/dashboard/library");
  return { ok: true };
}

// «Crea il viaggio da questo itinerario» per un itinerario dell'agenzia
export async function createTripFromAgencyItinerary(id: string): Promise<{ error: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Itinerario non valido." };
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const supabase = await createClient();
  const { data } = await supabase.from("agency_itineraries").select(COLUMNS).eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!data) return { error: "Itinerario non trovato." };
  const it = data as AgencyItinerary;
  const { createTripFromProposals } = await import("@/app/dashboard/trips/new/zefiroActions");
  return createTripFromProposals({
    title: `${it.place_label} · ${it.title}`.slice(0, 200),
    destination: it.place_label,
    clientId: null,
    startDate: null,
    proposals: [{ name: it.title.slice(0, 120), itinerary: it.program }],
  });
}
