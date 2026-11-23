import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { loadTripDays } from "@/lib/tripDays";
import ItineraryEditor from "@/components/ItineraryEditor";
import type { Activity, ActivityPhoto, TripDay } from "@/lib/types";
import DeleteTravelerTrip from "./DeleteTravelerTrip";
import TripHeader from "./TripHeader";

type DayWithActivities = TripDay & { activities: (Activity & { activity_photos: ActivityPhoto[] })[] };

export default async function TravelerTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCachedUser();
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, title, destination, start_date, end_date, itinerary_mode").eq("id", id).eq("owner_id", user?.id ?? "").maybeSingle();
  if (!trip) notFound();

  const { data: days, error } = await loadTripDays(supabase, id);
  const ordered = ((days as DayWithActivities[] | null) ?? []).map((d) => ({
    ...d,
    activities: [...(d.activities ?? [])].sort((a, b) => a.activity_order - b.activity_order),
  }));

  return (
    <div className="flex flex-col gap-5">
      <TripHeader trip={trip} active="itinerario" />

      {error ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Non sono riuscito a caricare l&apos;itinerario. Ricarica la pagina.</p>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white shadow-md shadow-[#e6d7bb]/30">
          <div className="bg-gradient-to-r from-[#233c5e] via-[#333d4a] to-[#17283f] px-5 py-3">
            <h2 className="text-lg font-semibold text-white">Itinerario</h2>
            <p className="text-xs text-[#cbd1d8]">Giorno per giorno: aggiungi, sposta e cambia le attività come vuoi.</p>
          </div>
          <div className="bg-gradient-to-b from-white to-[#fbf7ec] p-2 sm:p-5">
            <ItineraryEditor tripId={trip.id} days={ordered} templates={[]} documentsByActivity={{}} mode={trip.itinerary_mode === "days" ? "days" : "activities"} />
          </div>
        </section>
      )}

      <Link href={`/viaggiatore/viaggi/${trip.id}/agenzia`} className="rounded-2xl border border-[#233c5e]/40 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-[#233c5e]">
        <strong className="text-[#233c5e]">Vuoi che sia un&apos;agenzia a prenotare e seguirti?</strong> Fallo preparare da un&apos;agenzia: le mandi questo itinerario e ti risponde →
      </Link>

      <Link href="/viaggiatore/mappamondo" className="rounded-2xl border border-[#e6d7bb] bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-[#cda876]">
        <strong className="text-[#233c5e]">Diario e foto</strong> di questo viaggio: aprili dal mappamondo, toccando il paese o il luogo →
      </Link>

      <div className="flex justify-end">
        <DeleteTravelerTrip tripId={trip.id} />
      </div>
    </div>
  );
}
