import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, Profile, TripDay } from "@/lib/types";
import { activityTypes } from "@/lib/activityTypes";
import { themeFontVariables } from "@/lib/themeFonts";
import { richTextClassName, toSafeHtml } from "@/lib/richText";
import { sanitizeHtml } from "@/lib/sanitize";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

function dayDateLabel(day: TripDay, index: number) {
  return day.day_date
    ? new Date(day.day_date).toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : `Giorno ${index + 1}`;
}

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
      .select("*, activities(*, activity_photos(*))")
      .eq("trip_id", trip.id)
      .order("day_order", { ascending: true }),
    supabase.from("profiles").select("*").eq("id", trip.owner_id).single(),
  ]);

  const orderedDays = ((days as DayWithActivities[]) || []).map((day) => ({
    ...day,
    activities: (day.activities || []).sort((a, b) => a.activity_order - b.activity_order),
  }));

  const theme = trip.theme || "elegante";
  const agencyName = (owner as Profile | null)?.agency_name;

  return (
    <div data-theme={theme} className={`themed-page ${themeFontVariables} min-h-screen`}>
      <header className="theme-accent-bg relative flex min-h-[18rem] items-end overflow-hidden px-4 py-10 text-white">
        <div className="relative mx-auto w-full max-w-3xl">
          {agencyName && <span className="text-sm font-medium opacity-90">{agencyName}</span>}
          <h1 className="theme-heading-font text-3xl font-semibold text-white">{trip.title}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="theme-card mb-10 p-5">
          <h2 className="theme-heading-font mb-3 text-lg font-semibold">Riepilogo del viaggio</h2>
          <div className="flex flex-col gap-3">
            {orderedDays.map((day, index) => (
              <div key={day.id} className="theme-border border-t pt-3 first:border-t-0 first:pt-0">
                <p className="theme-heading-font text-sm font-semibold capitalize">
                  {dayDateLabel(day, index)}
                  {day.title && <span className="font-normal"> — {day.title}</span>}
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {day.activities.map((activity) => (
                    <li key={activity.id} className="flex items-baseline gap-2 text-sm">
                      <span>{activity.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-8">
          {orderedDays.map((day, index) => (
            <section key={day.id}>
              <h2 className="theme-heading-font mb-3 text-lg font-semibold capitalize">
                {dayDateLabel(day, index)}
              </h2>
              <ol className="flex flex-col gap-3">
                {day.activities.map((activity) => {
                  const meta = activityTypes[activity.activity_type];
                  const Icon = meta.icon;
                  return (
                    <li
                      key={activity.id}
                      style={{ borderLeftColor: meta.color }}
                      className="theme-card border-l-4 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          style={{ backgroundColor: meta.color }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                        >
                          <Icon size={13} />
                        </span>
                        <span className="font-medium">{activity.title}</span>
                      </div>
                      {activity.description && (
                        <div
                          className={richTextClassName + " mt-1"}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(toSafeHtml(activity.description)) }}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
