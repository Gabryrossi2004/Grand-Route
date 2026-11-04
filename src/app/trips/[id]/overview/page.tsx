import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Profile, TripDay } from "@/lib/types";
import { activityTypes } from "@/lib/activityTypes";
import { formatEuro, getDisplayPrice } from "@/lib/price";
import { themeFontVariables } from "@/lib/themeFonts";
import PrintButton from "@/components/PrintButton";

type DayWithActivities = TripDay & { activities: Activity[] };

export default async function TripOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) notFound();

  const [{ data: days }, { data: owner }] = await Promise.all([
    supabase
      .from("trip_days")
      .select("*, activities(*)")
      .eq("trip_id", id)
      .order("day_order", { ascending: true }),
    supabase.from("profiles").select("*").eq("id", trip.owner_id).single(),
  ]);

  const orderedDays = ((days as DayWithActivities[]) || []).map((day) => ({
    ...day,
    activities: (day.activities || []).sort((a, b) => a.activity_order - b.activity_order),
  }));

  const theme = trip.theme || "elegante";
  const agencyName = (owner as Profile | null)?.agency_name;
  const logoUrl = (owner as Profile | null)?.logo_url;
  const price = getDisplayPrice(trip);

  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString("it-IT")} – ${new Date(trip.end_date).toLocaleDateString("it-IT")}`
      : null;

  return (
    <div data-theme={theme} className={`themed-page ${themeFontVariables} min-h-screen print:bg-none`}>
      <div className="mx-auto max-w-3xl px-4 py-6 print:hidden">
        <PrintButton />
      </div>

      <div className="theme-card mx-auto max-w-3xl shadow-sm print:shadow-none">
        <header
          className="theme-accent-bg relative flex min-h-[20rem] flex-col justify-between bg-cover bg-center p-8 text-white print:min-h-[14rem]"
          style={{
            backgroundImage: trip.cover_image_url ? `url(${trip.cover_image_url})` : undefined,
          }}
        >
          {trip.cover_image_url && <div className="absolute inset-0 bg-black/30" />}
          <div className="relative flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl && <img src={logoUrl} alt="" className="h-8 rounded bg-white/90 p-1" />}
            {agencyName && <span className="text-sm font-medium opacity-90">{agencyName}</span>}
          </div>
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80">La tua prossima avventura</p>
            <h1
              className="theme-heading-font mt-1 text-4xl font-bold leading-tight"
              style={{ color: trip.title_color || "#ffffff" }}
            >
              {trip.title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-3 text-sm opacity-90">
              {trip.destination && <span>{trip.destination}</span>}
              {dateRange && <span>· {dateRange}</span>}
              {orderedDays.length > 0 && <span>· {orderedDays.length} giorni</span>}
            </div>
          </div>
        </header>

        <main className="p-8">
          <div className="flex flex-col gap-6">
            {orderedDays.map((day, index) => {
              const dateLabel = day.day_date
                ? new Date(day.day_date).toLocaleDateString("it-IT", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })
                : `Giorno ${index + 1}`;

              return (
                <section key={day.id} className="theme-border break-inside-avoid">
                  <h2 className="theme-accent theme-border mb-2 border-b pb-1 text-sm font-semibold uppercase tracking-wide">
                    {dateLabel}
                    {day.title && <span className="font-normal normal-case"> — {day.title}</span>}
                  </h2>
                  <ul className="flex flex-col gap-1.5">
                    {day.activities.map((activity) => {
                      const meta = activityTypes[activity.activity_type];
                      const Icon = meta.icon;
                      return (
                        <li key={activity.id} className="flex items-center gap-2 text-sm">
                          <span
                            style={{ backgroundColor: meta.color }}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                          >
                            <Icon size={11} />
                          </span>
                          {activity.start_time && (
                            <span className="theme-muted font-medium">{activity.start_time.slice(0, 5)}</span>
                          )}
                          <span className="font-medium">{activity.title}</span>
                          {activity.location && <span className="theme-muted">— {activity.location}</span>}
                        </li>
                      );
                    })}
                    {day.activities.length === 0 && (
                      <li className="theme-muted text-sm">Giornata libera</li>
                    )}
                  </ul>
                </section>
              );
            })}

            {orderedDays.length === 0 && (
              <p className="theme-muted text-sm">Itinerario ancora da completare.</p>
            )}
          </div>

          {price && (
            <section className="theme-card mt-8 break-inside-avoid p-5">
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
                  <div className="theme-accent theme-border mt-1 flex justify-between border-t pt-1 text-base font-semibold">
                    <span>Totale</span>
                    <span>{formatEuro(price.total)}</span>
                  </div>
                </div>
              ) : (
                <div className="theme-accent text-2xl font-bold">{formatEuro(price.total)}</div>
              )}
            </section>
          )}

          <footer className="theme-border theme-muted mt-10 border-t pt-4 text-center text-xs">
            {agencyName ? `Preparato da ${agencyName}` : "Preparato per te"}
          </footer>
        </main>
      </div>
    </div>
  );
}
