import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { loadTripDays } from "@/lib/tripDays";
import ItineraryEditor from "@/components/ItineraryEditor";
import TripTitleEditor from "@/components/TripTitleEditor";
import type { Activity, ActivityPhoto, TripDay } from "@/lib/types";
import DeleteTravelerTrip from "./DeleteTravelerTrip";

type DayWithActivities = TripDay & { activities: (Activity & { activity_photos: ActivityPhoto[] })[] };
const dateIt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

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
      <div>
        <Link href="/viaggiatore" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#233c5e]">
          <ArrowLeft size={14} /> I miei viaggi
        </Link>
        <TripTitleEditor tripId={trip.id} title={trip.title} destination={trip.destination} />
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
          {trip.destination && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-[#c58f2d]" /> {trip.destination}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-[#c58f2d]" />
            {trip.start_date ? `${dateIt(trip.start_date)}${trip.end_date ? ` – ${dateIt(trip.end_date)}` : ""}` : "Date da decidere: impostale nella barra dei giorni"}
          </span>
        </p>
      </div>

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

      <div className="flex justify-end">
        <DeleteTravelerTrip tripId={trip.id} />
      </div>
    </div>
  );
}
