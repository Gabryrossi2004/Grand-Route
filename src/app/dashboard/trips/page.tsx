import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";

function formatDateRange(trip: Trip) {
  if (!trip.start_date) return "Date da definire";
  const start = new Date(trip.start_date).toLocaleDateString("it-IT");
  if (!trip.end_date) return start;
  const end = new Date(trip.end_date).toLocaleDateString("it-IT");
  return `${start} – ${end}`;
}

export default async function TripsPage() {
  const supabase = await createClient();
  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });

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

      {!trips || trips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">Non hai ancora creato nessun viaggio.</p>
          <Link href="/dashboard/trips/new" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Crea il primo viaggio
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(trips as Trip[]).map((trip) => (
            <Link
              key={trip.id}
              href={`/dashboard/trips/${trip.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-medium text-slate-900">{trip.title}</h2>
                {trip.is_published && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Pubblicato
                  </span>
                )}
              </div>
              {trip.destination && <p className="text-sm text-slate-500">{trip.destination}</p>}
              <p className="mt-2 text-xs text-slate-400">{formatDateRange(trip)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
