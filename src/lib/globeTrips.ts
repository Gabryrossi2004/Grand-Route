import { loadTripDays } from "@/lib/tripDays";
import { loadTripPlaces, romeToday, type DayInput } from "@/lib/destinationInfo";
import type { GlobeTrip } from "@/components/TravelGlobe";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
type TripRow = { id: string; title: string; destination: string | null; start_date: string | null; end_date: string | null };
type DayRow = { day_date: string | null; title: string | null; activities?: { location: string | null; activity_type: string | null }[] };

// I viaggi per il mappamondo (area clienti e area viaggiatori): luoghi con coordinate ricavati dall'itinerario
export async function loadGlobeTrips(supabase: Db, tripRows: TripRow[]): Promise<GlobeTrip[]> {
  const today = romeToday();
  const trips = await Promise.all(
    tripRows.slice(0, 30).map(async (trip): Promise<GlobeTrip> => {
      const { data } = await loadTripDays(supabase, trip.id, false);
      const days: DayInput[] = ((data as DayRow[] | null) ?? []).map((d) => ({
        date: d.day_date,
        title: d.title,
        places: (d.activities ?? []).map((a) => ({ location: a.location, type: a.activity_type })),
      }));
      const places = await loadTripPlaces(trip.destination, days);
      const status: GlobeTrip["status"] =
        trip.end_date && trip.end_date < today ? "done" : trip.start_date && trip.start_date > today ? "upcoming" : trip.start_date ? "current" : "upcoming";
      return {
        id: trip.id,
        title: trip.title,
        destination: trip.destination,
        from: trip.start_date,
        to: trip.end_date,
        status,
        places: places.map((p) => ({ name: p.place, lat: p.latitude, lon: p.longitude })),
      };
    }),
  );
  return trips.filter((t) => t.places.length > 0);
}
