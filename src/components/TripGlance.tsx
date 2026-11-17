import type { Trip } from "@/lib/types";
import { getT } from "@/lib/i18n/server";
import { translate, type TKey, type Vars } from "@/lib/i18n";
import {
  countdownText,
  describeWeather,
  loadTripStops,
  tripCountdown,
  type DayInput,
  type StopInfo,
} from "@/lib/destinationInfo";

function dayName(iso: string, locale: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short" });
}

type GlanceDay = {
  day_date: string | null;
  title: string | null;
  activities: { location: string | null; activity_type: string }[];
};

// Riquadro in cima al viaggio, nell'area clienti: conto alla rovescia e, per
// ogni tappa dell'itinerario, ora e meteo del posto.
export default async function TripGlance({ trip, days }: { trip: Trip; days: GlanceDay[] }) {
  const inputs: DayInput[] = days.map((day) => ({
    date: day.day_date,
    title: day.title,
    places: day.activities.map((a) => ({ location: a.location, type: a.activity_type })),
  }));
  const stops = await loadTripStops(trip.destination, trip.start_date, inputs);
  const { t, locale } = await getT();
  return <TripGlanceView trip={trip} stops={stops} t={t} locale={locale} />;
}

function stopLabel(stop: StopInfo, t: (key: TKey, vars?: Vars) => string) {
  return stop.firstDay === stop.lastDay
    ? t("glance.stopDay", { n: stop.firstDay })
    : t("glance.stopDays", { a: stop.firstDay, b: stop.lastDay });
}

export function TripGlanceView({
  trip,
  stops,
  t = (key, vars) => translate("it", key, vars),
  locale = "it-IT",
}: {
  trip: Pick<Trip, "start_date" | "end_date">;
  stops: StopInfo[];
  t?: (key: TKey, vars?: Vars) => string;
  locale?: string;
}) {
  const countdown = countdownText(tripCountdown(trip.start_date, trip.end_date), t);
  if (!countdown && stops.length === 0) return null;

  const someWithoutForecast = stops.some((s) => s.daily.length === 0);

  return (
    <section className="theme-card mb-8 overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {countdown && (
          <div className="theme-accent-bg flex shrink-0 flex-col items-center justify-center px-8 py-5 text-center text-white sm:w-48">
            <span className="theme-heading-font text-4xl font-semibold leading-none" style={{ color: "#ffffff" }}>
              {countdown.big}
            </span>
            <span className="mt-1.5 text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>
              {countdown.small}
            </span>
          </div>
        )}
        {stops.length > 0 && (
          <div className="min-w-0 flex-1 divide-y divide-black/10">
            {stops.map((stop, index) => {
              const previous = stops[index - 1];
              const showTime = !previous || previous.hoursFromItaly !== stop.hoursFromItaly;
              const diff = stop.hoursFromItaly;
              return (
                <div key={`${stop.place}-${stop.firstDay}`} className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="theme-heading-font text-base font-semibold">
                      {stop.place}
                      {stop.country && stops.length > 1 && stop.country !== previous?.country && (
                        <span className="theme-muted ml-1.5 text-sm font-normal">· {stop.country}</span>
                      )}
                    </p>
                    <p className="theme-muted text-xs">{stopLabel(stop, t)}</p>
                  </div>
                  {showTime && (
                    <p className="theme-muted text-sm">
                      {t("glance.localTime", { time: "\u0000" })
                        .split("\u0000")
                        .reduce<React.ReactNode[]>((acc, part, i, all) => {
                          acc.push(part);
                          if (i < all.length - 1) acc.push(<strong key={i} className="text-current">{stop.localTime}</strong>);
                          return acc;
                        }, [])}
                      {diff === 0
                        ? t("glance.sameTime")
                        : t(Math.abs(diff) === 1 ? "glance.diffHour" : "glance.diffHours", { sign: diff > 0 ? "+" : "−", n: Math.abs(diff) })}
                    </p>
                  )}
                  {stop.daily.length > 0 ? (
                    <ul className="mt-2 grid grid grid-cols-[repeat(auto-fill,minmax(3.6rem,5rem))] gap-1.5 text-center">
                      {stop.daily.map((d) => (
                        <li key={d.date} className="rounded-lg bg-black/[0.04] px-1 py-2">
                          <p className="theme-muted text-xs capitalize">{dayName(d.date, locale)}</p>
                          <p className="text-xl" title={describeWeather(d.code, t).label}>
                            {describeWeather(d.code, t).icon}
                          </p>
                          <p className="text-xs font-semibold">{Math.round(d.max)}°</p>
                          <p className="theme-muted text-xs">{Math.round(d.min)}°</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    stop.current && (
                      <p className="mt-1 text-sm">
                        <span className="text-2xl">{describeWeather(stop.current.code, t).icon}</span>{" "}
                        <strong>{Math.round(stop.current.temp)}°</strong> {t("glance.now")},{" "}
                        {describeWeather(stop.current.code, t).label.toLowerCase()}
                      </p>
                    )
                  )}
                </div>
              );
            })}
            {someWithoutForecast && (
              <p className="theme-muted px-4 py-2 text-xs">
                {t("glance.forecastNote")}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
