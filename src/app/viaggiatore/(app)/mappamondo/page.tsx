import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { loadGlobeTrips } from "@/lib/globeTrips";
import GlobeLoader from "@/components/GlobeLoader";
import { countPhotosByCountry, latestPhotoByCountry } from "@/lib/actions/clientPhotos";
import { countJournalByPlace } from "@/lib/actions/clientJournal";

export const metadata = { title: "Il tuo mappamondo" };
// Le località si cercano in rete (in cache per 30 giorni): con molti viaggi serve qualche secondo
export const maxDuration = 60;

export default async function TravelerGlobePage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  const { data: tripRows } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date")
    .eq("owner_id", user?.id ?? "")
    .order("start_date", { ascending: false, nullsFirst: false });
  const trips = await loadGlobeTrips(supabase, (tripRows as { id: string; title: string; destination: string | null; start_date: string | null; end_date: string | null }[]) ?? []);
  const [photoCounts, photoThumbs, placeNotes] = await Promise.all([countPhotosByCountry(), latestPhotoByCountry(), countJournalByPlace()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Il tuo mappamondo</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-600">
          I paesi dei tuoi viaggi diventano d&apos;oro e la linea tratteggiata segue il percorso. Tocca un paese o un luogo: si apre la bacheca dei ricordi, con le tue foto e il tuo diario di viaggio. Foto e note sono private.
        </p>
      </div>
      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-6 text-sm text-slate-600">
          Qui comparirà il mappamondo non appena un tuo viaggio avrà delle località (per esempio dalle proposte pronte).{" "}
          <Link href="/viaggiatore/nuovo" className="font-medium text-[#233c5e] underline">
            Crea un viaggio
          </Link>
        </div>
      ) : (
        <GlobeLoader trips={trips} userId={user?.id ?? ""} photoCounts={photoCounts} photoThumbs={photoThumbs} placeNotes={placeNotes} />
      )}
    </div>
  );
}
