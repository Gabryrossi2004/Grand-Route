import type { createClient } from "@/lib/supabase/server";
import { loadTripDays } from "@/lib/tripDays";
import { loadTripPlaces, type DayInput } from "@/lib/destinationInfo";

type Db = Awaited<ReturnType<typeof createClient>>;
type DayRow = { day_date: string | null; title: string | null; activities?: { location: string | null; activity_type: string | null }[] };

// Paesi toccati da un viaggio (codici ISO a due lettere), ricavati dalle località dell'itinerario
// e, se l'itinerario non ne ha, dalla destinazione. Nessuna AI: solo ricerca delle località (Open-Meteo).
export async function computeTripCountries(supabase: Db, trip: { id: string; destination: string | null }): Promise<string[]> {
  const { data } = await loadTripDays(supabase, trip.id, false);
  const days: DayInput[] = ((data as DayRow[] | null) ?? []).map((d) => ({
    date: d.day_date,
    title: d.title,
    places: (d.activities ?? []).map((a) => ({ location: a.location, type: a.activity_type })),
  }));
  const places = await loadTripPlaces(trip.destination, days);
  const codes: string[] = [];
  for (const p of places) {
    const code = p.countryCode?.toUpperCase();
    if (code && /^[A-Z]{2}$/.test(code) && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

// Calcola e salva i paesi dei viaggi che non li hanno ancora (al massimo `limit` per volta,
// entro un tempo massimo, così la pagina resta veloce anche con molti viaggi).
export async function fillMissingCountries(
  supabase: Db,
  trips: { id: string; destination: string | null; auto_countries: string[] | null }[],
  limit = 30,
  budgetMs = 35_000,
) {
  const missing = trips.filter((t) => t.auto_countries === null).slice(0, limit);
  const started = Date.now();
  for (let i = 0; i < missing.length; i += 5) {
    if (Date.now() - started > budgetMs) break;
    await Promise.all(
      missing.slice(i, i + 5).map(async (trip) => {
        try {
          const codes = await computeTripCountries(supabase, trip);
          trip.auto_countries = codes;
          await supabase.from("trips").update({ auto_countries: codes }).eq("id", trip.id);
        } catch (e) {
          console.error("[tripCountries]", trip.id, e);
        }
      }),
    );
  }
}
