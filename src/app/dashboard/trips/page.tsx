import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Trip, TripGroup } from "@/lib/types";

function formatDateRange(trip: Trip) {
  if (!trip.start_date) return "Date da definire";
  const start = new Date(trip.start_date).toLocaleDateString("it-IT");
  if (!trip.end_date) return start;
  const end = new Date(trip.end_date).toLocaleDateString("it-IT");
  return `${start} – ${end}`;
}

function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link
      href={`/dashboard/trips/${trip.id}`}
      className="block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow"
    >
      <div
        className="h-28 bg-slate-200 bg-cover bg-center"
        style={
          trip.cover_image_url
            ? { backgroundImage: `url(${trip.cover_image_url})` }
            : { backgroundImage: "linear-gradient(135deg, #e2e8f0, #cbd5e1)" }
        }
      />
      <div className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-medium text-slate-900">{trip.title}</h3>
          {trip.is_published && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Pubblicato
            </span>
          )}
        </div>
        {trip.destination && <p className="text-sm text-slate-500">{trip.destination}</p>}
        <p className="mt-2 text-xs text-slate-400">{formatDateRange(trip)}</p>
      </div>
    </Link>
  );
}

export default async function TripsPage() {
  const supabase = await createClient();

  const [{ data: trips }, { data: groups }] = await Promise.all([
    supabase.from("trips").select("*").order("created_at", { ascending: false }),
    supabase.from("trip_groups").select("*").order("created_at", { ascending: false }),
  ]);

  const allTrips = (trips as Trip[]) || [];
  const allGroups = (groups as TripGroup[]) || [];

  const groupedSections = allGroups
    .map((group) => ({ group, trips: allTrips.filter((trip) => trip.group_id === group.id) }))
    .filter((section) => section.trips.length > 0);

  const ungroupedTrips = allTrips.filter((trip) => !trip.group_id);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Viaggi</h1>
        <Link
          href="/dashboard/trips/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuovo viaggio
        </Link>
      </div>

      {allTrips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">Non hai ancora creato nessun viaggio.</p>
          <Link href="/dashboard/trips/new" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Crea il primo viaggio
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groupedSections.map(({ group, trips: variantTrips }) => (
            <section key={group.id}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {group.title} · {variantTrips.length} {variantTrips.length === 1 ? "variante" : "varianti"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {variantTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          ))}

          {ungroupedTrips.length > 0 && (
            <section>
              {groupedSections.length > 0 && (
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Altri viaggi</h2>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ungroupedTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
