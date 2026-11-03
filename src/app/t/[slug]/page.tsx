import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, Profile, TripDay } from "@/lib/types";
import { activityTypes, detailFieldLabels, visibleDetailEntries } from "@/lib/activityTypes";
import { richTextClassName, toSafeHtml } from "@/lib/richText";
import { formatEuro, getDisplayPrice } from "@/lib/price";
import { themeFontVariables } from "@/lib/themeFonts";
import PhotoGallery from "@/components/PhotoGallery";
import Image from "next/image";

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
  let debugInfo: string | null = null;
  try {
    return await renderTrip(slug);
  } catch (err) {
    const digest = (err as { digest?: string } | null)?.digest;
    if (digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw err;
    debugInfo = err instanceof Error ? `${err.message}\n${err.stack}` : JSON.stringify(err);
  }
  return <pre style={{ whiteSpace: "pre-wrap", padding: 20 }}>DEBUG TEMPORANEO:{"\n"}{debugInfo}</pre>;
}

async function renderTrip(slug: string) {
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

  // La libreria di pulizia HTML (isomorphic-dompurify) è pesante: la
  // importiamo "al volo" solo se serve davvero, invece di caricarla sempre
  // insieme a tutti i font dei temi. In produzione le due cose insieme
  // mandavano in crash questa pagina.
  const sanitizedDescriptions = new Map<string, string>();
  const hasDescriptions = orderedDays.some((day) => day.activities.some((a) => a.description));
  if (hasDescriptions) {
    try {
      const { sanitizeHtml } = await import("@/lib/sanitize");
      for (const day of orderedDays) {
        for (const activity of day.activities) {
          if (activity.description) {
            sanitizedDescriptions.set(activity.id, sanitizeHtml(toSafeHtml(activity.description)));
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? `${err.message}\n${err.stack}` : JSON.stringify(err);
      throw new Error("SANITIZE_ERROR: " + msg);
    }
  }

  const theme = trip.theme || "elegante";
  const agencyName = (owner as Profile | null)?.agency_name;
  const logoUrl = (owner as Profile | null)?.logo_url;
  const price = getDisplayPrice(trip);

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString("it-IT")} – ${new Date(trip.end_date).toLocaleDateString("it-IT")}`
      : null;

  return (
    <div data-theme={theme} className={`themed-page ${themeFontVariables} min-h-screen`}>
      <header className="theme-accent-bg relative flex min-h-[18rem] items-end overflow-hidden px-4 py-10 text-white">
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
          <h1 className="theme-heading-font text-3xl font-semibold text-white">{trip.title}</h1>
          {trip.destination && <p className="mt-1 text-white/90">{trip.destination}</p>}
          {dateRange && <p className="mt-1 text-sm text-white/80">{dateRange}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {orderedDays.length === 0 && (
          <p className="theme-muted">L&apos;itinerario sarà disponibile a breve.</p>
        )}

        {orderedDays.length > 0 && (
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
                        {activity.start_time && (
                          <span className="theme-muted shrink-0 text-xs">{activity.start_time.slice(0, 5)}</span>
                        )}
                        <span>{activity.title}</span>
                      </li>
                    ))}
                    {day.activities.length === 0 && (
                      <li className="theme-muted text-sm">Giornata libera</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-8">
          {orderedDays.map((day, index) => {
            const dateLabel = dayDateLabel(day, index);

            return (
              <section key={day.id}>
                <h2 className="theme-heading-font mb-3 text-lg font-semibold capitalize">
                  {dateLabel}
                  {day.title && <span className="font-normal"> — {day.title}</span>}
                </h2>
                <ol className="flex flex-col gap-3">
                  {day.activities.map((activity) => {
                    const meta = activityTypes[activity.activity_type];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={activity.id}
                        style={{ borderLeftColor: meta.color }}
                        className="theme-card border-l-4 px-4 py-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
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
                          <span className="font-medium">{activity.title}</span>
                          <span
                            style={{ color: meta.color, borderColor: meta.color }}
                            className="rounded-full border px-2 py-0.5 text-xs font-medium"
                          >
                            {meta.label}
                          </span>
                        </div>
                        {activity.location && <p className="theme-muted mt-1 text-sm">{activity.location}</p>}
                        {activity.description && (
                          <div
                            className={richTextClassName + " mt-1"}
                            dangerouslySetInnerHTML={{ __html: sanitizedDescriptions.get(activity.id) ?? "" }}
                          />
                        )}
                        {visibleDetailEntries(activity.details).length > 0 && (
                          <dl className="theme-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {visibleDetailEntries(activity.details).map(([key, value]) => (
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
                    <li className="theme-muted text-sm">Nessuna attività pianificata.</li>
                  )}
                </ol>
              </section>
            );
          })}
        </div>

        {price && (
          <section className="theme-card mt-10 p-5">
            <h2 className="theme-muted mb-2 text-sm font-semibold uppercase tracking-wide">Quota di partecipazione</h2>
            {price.breakdown ? (
              <div className="theme-muted flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span>Costo del viaggio</span>
                  <span>{formatEuro(price.breakdown.net)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Servizio di organizzazione</span>
                  <span>{formatEuro(price.breakdown.commission)}</span>
                </div>
                <div className="theme-border theme-accent mt-1 flex justify-between border-t pt-1 text-base font-semibold">
                  <span>Totale</span>
                  <span>{formatEuro(price.total)}</span>
                </div>
              </div>
            ) : (
              <div className="theme-accent text-2xl font-bold">{formatEuro(price.total)}</div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
