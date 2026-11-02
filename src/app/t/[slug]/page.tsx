import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, Profile, TripDay } from "@/lib/types";
import { activityTypes, detailFieldLabels } from "@/lib/activityTypes";
import { richTextClassName, toSafeHtml } from "@/lib/richText";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatEuro, getDisplayPrice } from "@/lib/price";
import PhotoGallery from "@/components/PhotoGallery";
import Image from "next/image";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

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

  const brandColor = (owner as Profile | null)?.brand_color || "#2563eb";
  const agencyName = (owner as Profile | null)?.agency_name;
  const logoUrl = (owner as Profile | null)?.logo_url;
  const price = getDisplayPrice(trip);

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString("it-IT")} – ${new Date(trip.end_date).toLocaleDateString("it-IT")}`
      : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="relative flex min-h-[16rem] items-end overflow-hidden px-4 py-10 text-white"
        style={{ backgroundColor: brandColor }}
      >
        {trip.cover_image_url && (
          <>
            <Image
              src={trip.cover_image_url}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}
        <div className="relative mx-auto w-full max-w-3xl">
          {(logoUrl || agencyName) && (
            <div className="mb-3 flex items-center gap-2">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-8 rounded bg-white/90 p-1" />
              )}
              {agencyName && <span className="text-sm font-medium opacity-90">{agencyName}</span>}
            </div>
          )}
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
                <ol className="flex flex-col gap-3">
                  {day.activities.map((activity) => {
                    const meta = activityTypes[activity.activity_type];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={activity.id}
                        style={{ borderLeftColor: meta.color, backgroundColor: meta.bg }}
                        className="rounded-md border-l-4 px-4 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            style={{ backgroundColor: meta.color }}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                          >
                            <Icon size={13} />
                          </span>
                          {activity.start_time && (
                            <span className="text-sm font-medium" style={{ color: meta.color }}>
                              {activity.start_time.slice(0, 5)}
                            </span>
                          )}
                          <span className="font-medium text-slate-900">{activity.title}</span>
                          <span
                            style={{ color: meta.color, borderColor: meta.color }}
                            className="rounded-full border px-2 py-0.5 text-xs font-medium"
                          >
                            {meta.label}
                          </span>
                        </div>
                        {activity.location && <p className="mt-1 text-sm text-slate-500">{activity.location}</p>}
                        {activity.description && (
                          <div
                            className={richTextClassName + " mt-1"}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(toSafeHtml(activity.description)) }}
                          />
                        )}
                        {Object.entries(activity.details || {}).length > 0 && (
                          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                            {Object.entries(activity.details).map(([key, value]) => (
                              <div key={key} className="flex gap-1">
                                <dt className="font-medium">{detailFieldLabels[key] ?? key}:</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {activity.activity_photos && activity.activity_photos.length > 0 && (
                          <PhotoGallery photos={activity.activity_photos} />
                        )}
                      </li>
                    );
                  })}
                  {day.activities.length === 0 && (
                    <li className="text-sm text-slate-400">Nessuna attività pianificata.</li>
                  )}
                </ol>
              </section>
            );
          })}
        </div>

        {price && (
          <section className="mt-10 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Quota di partecipazione</h2>
            {price.breakdown ? (
              <div className="flex flex-col gap-1 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Costo del viaggio</span>
                  <span>{formatEuro(price.breakdown.net)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Servizio di organizzazione</span>
                  <span>{formatEuro(price.breakdown.commission)}</span>
                </div>
                <div
                  style={{ color: brandColor }}
                  className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base font-semibold"
                >
                  <span>Totale</span>
                  <span>{formatEuro(price.total)}</span>
                </div>
              </div>
            ) : (
              <div style={{ color: brandColor }} className="text-2xl font-bold">
                {formatEuro(price.total)}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
