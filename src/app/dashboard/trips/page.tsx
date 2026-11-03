import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Trip, TripGroup } from "@/lib/types";
import TripCard from "@/components/TripCard";

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: trips }, { data: groups }] = await Promise.all([
    supabase
      .from("trips")
      .select("*")
      .eq("owner_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("trip_groups")
      .select("*")
      .eq("owner_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
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
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
        >
          + Nuovo viaggio
        </Link>
      </div>

      {allTrips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
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
