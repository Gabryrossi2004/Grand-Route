import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Profile, TripDay } from "@/lib/types";

type DayWithActivities = TripDay & { activities: Activity[] };

export default async function PublicTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("public_slug", slug)
    .eq("is_published", true)
    .single();

  if (!trip) notFound();

  const [{ data: days }, { data: owner }] = await Promise.all([
    supabase
      .from("trip_days")
      .select("*, activities(*)")
      .eq("trip_id", trip.id)
      .order("day_order", { ascending: true }),
    supabase.from("profiles").select("*").eq("id", trip.owner_id).single(),
  ]);

  const orderedDays = ((days as DayWithActivities[]) || []).map((day) => ({
    ...day,
    activities: (day.activities || []).sort((a, b) => a.activity_order - b.activity_order),
  }));

  const brandColor = (owner as Profile | null)?.brand_color || "#2563eb";
  const agencyName = (owner as Profile | null)?.agency_name;

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString("it-IT")} – ${new Date(trip.end_date).toLocaleDateString("it-IT")}`
      : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header style={{ backgroundColor: brandColor }} className="px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          {agencyName && <p className="mb-2 text-sm font-medium opacity-80">{agencyName}</p>}
          <h1 className="text-3xl font-semibold">{trip.title}</h1>
          {trip.destination && <p className="mt-1 text-white/90">{trip.destination}</p>}
          {dateRange && <p className="mt-1 text-sm text-white/80">{dateRange}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {orderedDays.length === 0 && (
          <p className="text-slate-500">L&apos;itinerario sarà disponibile a breve.</p>
        )}

        <div className="flex flex-col gap-8">
          {orderedDays.map((day, index) => {
            const dateLabel = day.day_date
              ? new Date(day.day_date).toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : `Giorno ${index + 1}`;

            return (
              <section key={day.id}>
                <h2 className="mb-3 text-lg font-semibold capitalize text-slate-900">{dateLabel}</h2>
                <ol className="flex flex-col gap-3 border-l-2 border-slate-200 pl-4">
                  {day.activities.map((activity) => (
                    <li key={activity.id}>
                      <div className="flex items-baseline gap-2">
                        {activity.start_time && (
                          <span className="text-sm font-medium" style={{ color: brandColor }}>
                            {activity.start_time.slice(0, 5)}
                          </span>
                        )}
                        <span className="font-medium text-slate-900">{activity.title}</span>
                      </div>
                      {activity.location && <p className="text-sm text-slate-500">{activity.location}</p>}
                      {activity.description && <p className="mt-1 text-sm text-slate-600">{activity.description}</p>}
                    </li>
                  ))}
                  {day.activities.length === 0 && (
                    <li className="text-sm text-slate-400">Nessuna attività pianificata.</li>
                  )}
                </ol>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
