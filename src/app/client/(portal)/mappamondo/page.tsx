import { createClient, getCachedUser } from "@/lib/supabase/server";
import { loadTripDays } from "@/lib/tripDays";
import { loadTripPlaces, romeToday, type DayInput } from "@/lib/destinationInfo";
import GlobeLoader from "@/components/GlobeLoader";
import type { GlobeTrip } from "@/components/TravelGlobe";
import { countPhotosByCountry, latestPhotoByCountry } from "@/lib/actions/clientPhotos";
import { countJournalByPlace } from "@/lib/actions/clientJournal";

// Le località si cercano in rete (in cache per 30 giorni): con molti viaggi serve qualche secondo
export const maxDuration = 60;

type DayRow = { day_date: string | null; title: string | null; activities?: { location: string | null; activity_type: string | null }[] };

export default async function ClientGlobePage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: myClients } = await supabase.from("clients").select("id").eq("user_id", user?.id ?? "");
  const clientIds = (myClients ?? []).map((c) => c.id as string);

  const { data: tripRows } =
    clientIds.length > 0
      ? await supabase
          .from("trips")
          .select("id, title, destination, start_date, end_date")
          .in("client_id", clientIds)
          .order("start_date", { ascending: false })
      : { data: [] };

  const today = romeToday();
  const trips: GlobeTrip[] = (
    await Promise.all(
      ((tripRows as { id: string; title: string; destination: string | null; start_date: string | null; end_date: string | null }[]) ?? []).slice(0, 30).map(
        async (trip): Promise<GlobeTrip> => {
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
        },
      ),
    )
  ).filter((t) => t.places.length > 0);

  const [photoCounts, photoThumbs, placeNotes] = await Promise.all([countPhotosByCountry(), latestPhotoByCountry(), countJournalByPlace()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Il tuo mappamondo</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-600">
          I paesi dove sei stato diventano d&apos;oro e la linea tratteggiata segue il percorso dei tuoi viaggi. Trascina per girare il globo, pizzica per ingrandire, tocca un paese o un luogo qui sotto: si apre la bacheca dei ricordi, con le tue foto e il tuo diario di viaggio. In alto a sinistra scegli l&apos;aspetto: carta d&apos;epoca oppure mappamondo fisico.
        </p>
      </div>
      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-6 text-sm text-slate-600">
          Qui comparirà il mappamondo dei tuoi viaggi non appena la tua agenzia ne preparerà uno per te.
        </div>
      ) : (
        <GlobeLoader trips={trips} userId={user?.id ?? ""} photoCounts={photoCounts} photoThumbs={photoThumbs} placeNotes={placeNotes} />
      )}
    </div>
  );
}
