import type { Activity, ActivityPhoto, Trip, TripDay, TripPayment } from "@/lib/types";
import { activityTypes, detailFieldLabel, visibleDetailEntries } from "@/lib/activityTypes";
import { richTextClassName, toSafeHtml } from "@/lib/richText";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatEuro, getDisplayPrice } from "@/lib/price";
import { themeFontVariables } from "@/lib/themeFonts";
import PhotoGallery from "@/components/PhotoGallery";
import Image from "next/image";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString("it-IT");
}

function dayDateLabel(day: TripDay, index: number) {
  return day.day_date
    ? new Date(day.day_date).toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : `Giorno ${index + 1}`;
}

// Presentazione dell'itinerario di un viaggio, brandizzata con il tema
// scelto dall'agenzia: usata sia dalla pagina pubblica (/t/[slug], accesso
// tramite link e viaggio pubblicato) sia dall'area clienti autenticata
// (/client/trips/[id], accesso tramite login e proprietà del viaggio).
export default function TripItineraryView({
  trip,
  days,
  agencyName,
  logoUrl,
  agencyTerms,
  headerExtra,
  payments,
}: {
  trip: Trip;
  days: DayWithActivities[];
  agencyName?: string | null;
  logoUrl?: string | null;
  agencyTerms?: string | null;
  headerExtra?: React.ReactNode;
  payments?: TripPayment[];
}) {
  const theme = trip.theme || "elegante";
  const price = getDisplayPrice(trip);

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString("it-IT")} – ${new Date(trip.end_date).toLocaleDateString("it-IT")}`
      : null;

  return (
    <div data-theme={theme} className={`themed-page ${themeFontVariables} min-h-screen`}>
      {headerExtra}
      <header className="theme-accent-bg relative flex min-h-[18rem] items-end overflow-hidden px-4 py-10 text-white">
        {trip.cover_image_url && (
          <>
            <Image src={trip.cover_image_url} alt="" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-black/25" />
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
          <h1 className="theme-heading-font text-3xl font-semibold" style={{ color: trip.title_color || "#ffffff" }}>
            {trip.title}
          </h1>
          {trip.destination && <p className="mt-1 text-white/90">{trip.destination}</p>}
          {dateRange && <p className="mt-1 text-sm text-white/80">{dateRange}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {trip.itinerary_stage === "preliminare" && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Itinerario preliminare.</strong> Voli, alloggi e servizi sono ancora indicativi e potrebbero
            cambiare prima della conferma definitiva.
          </div>
        )}

        {days.length === 0 && <p className="theme-muted">L&apos;itinerario sarà disponibile a breve.</p>}

        {days.length > 0 && (
          <section className="theme-card mb-10 p-5">
            <h2 className="theme-heading-font mb-3 text-lg font-semibold">Riepilogo del viaggio</h2>
            <div className="flex flex-col gap-3">
              {days.map((day, index) => (
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
                    {day.activities.length === 0 && <li className="theme-muted text-sm">Giornata libera</li>}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-8">
          {days.map((day, index) => {
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
                    const detailEntries = visibleDetailEntries(activity.details);
                    const hasBody =
                      activity.location ||
                      activity.description ||
                      detailEntries.length > 0 ||
                      (activity.activity_photos && activity.activity_photos.length > 0);
                    return (
                      <li
                        key={activity.id}
                        style={{ borderLeftColor: meta.color }}
                        className="theme-card overflow-hidden border-l-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div
                          style={{ backgroundColor: meta.bg }}
                          className="flex flex-wrap items-center gap-2 px-4 py-4"
                        >
                          <span
                            style={{ backgroundColor: meta.color }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                          >
                            <Icon size={16} weight="light" />
                          </span>
                          {activity.start_time && (
                            <span className="shrink-0 text-[15px] font-medium" style={{ color: meta.color }}>
                              {activity.start_time.slice(0, 5)}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 text-[17px] font-medium">{activity.title}</span>
                          <span
                            style={{ color: meta.color, borderColor: meta.color }}
                            className="shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium"
                          >
                            {meta.label}
                          </span>
                        </div>
                        {hasBody && (
                          <div className="px-4 py-3">
                            {activity.location && <p className="theme-muted text-sm">{activity.location}</p>}
                            {activity.description && (
                              <div
                                className={richTextClassName}
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(toSafeHtml(activity.description)) }}
                              />
                            )}
                            {detailEntries.length > 0 && (
                              <dl className="theme-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                {detailEntries.map(([key, value]) => (
                                  <div key={key} className="flex gap-1">
                                    <dt className="font-medium">{detailFieldLabel(activity.activity_type, key)}:</dt>
                                    <dd>{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            )}
                            {activity.activity_photos && activity.activity_photos.length > 0 && (
                              <PhotoGallery photos={activity.activity_photos} />
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {day.activities.length === 0 && <li className="theme-muted text-sm">Nessuna attività pianificata.</li>}
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

        {trip.show_rate_block && (trip.rate_includes || trip.rate_excludes || agencyTerms) && (
          <section className="theme-card mt-10 p-5">
            <h2 className="theme-heading-font mb-3 text-lg font-semibold">Tariffa &amp; Termini</h2>
            {(trip.rate_includes || trip.rate_excludes) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {trip.rate_includes && (
                  <div>
                    <h3 className="theme-muted mb-1 text-xs font-semibold uppercase tracking-wide">
                      La quota include
                    </h3>
                    <ul className="list-inside list-disc text-sm">
                      {trip.rate_includes.split("\n").filter(Boolean).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {trip.rate_excludes && (
                  <div>
                    <h3 className="theme-muted mb-1 text-xs font-semibold uppercase tracking-wide">
                      La quota non include
                    </h3>
                    <ul className="list-inside list-disc text-sm">
                      {trip.rate_excludes.split("\n").filter(Boolean).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {agencyTerms && (
              <div className="theme-border mt-4 border-t pt-4">
                <h3 className="theme-muted mb-1 text-xs font-semibold uppercase tracking-wide">
                  Termini e Condizioni
                </h3>
                <p className="theme-muted whitespace-pre-line text-sm">{agencyTerms}</p>
              </div>
            )}
          </section>
        )}

        {payments && payments.length > 0 && (
          <section className="theme-card mt-10 p-5">
            <h2 className="theme-heading-font mb-3 text-lg font-semibold">Pagamenti</h2>
            <ul className="flex flex-col gap-2">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="theme-border flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{payment.notes || "Quota viaggio"}</p>
                    {payment.due_date && <p className="theme-muted text-xs">Scadenza: {formatDate(payment.due_date)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatEuro(payment.amount)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        payment.paid_date ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {payment.paid_date ? "Pagato" : "Da pagare"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
