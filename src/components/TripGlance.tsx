import type { Trip } from "@/lib/types";
import {
  countdownText,
  describeWeather,
  loadTripStops,
  tripCountdown,
  type DayInput,
  type StopInfo,
} from "@/lib/destinationInfo";

function dayName(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { weekday: "short" });
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
  return <TripGlanceView trip={trip} stops={stops} />;
}

function stopLabel(stop: StopInfo) {
  const days = stop.firstDay === stop.lastDay ? `Giorno ${stop.firstDay}` : `Giorni ${stop.firstDay}–${stop.lastDay}`;
  return days;
}

export function TripGlanceView({
  trip,
  stops,
}: {
  trip: Pick<Trip, "start_date" | "end_date">;
  stops: StopInfo[];
}) {
  const countdown = countdownText(tripCountdown(trip.start_date, trip.end_date));
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
                    <p className="theme-muted text-xs">{stopLabel(stop)}</p>
                  </div>
                  {showTime && (
                    <p className="theme-muted text-sm">
                      Lì sono le <strong className="text-current">{stop.localTime}</strong>
                      {diff === 0
                        ? " (stessa ora dell'Italia)"
                        : ` (${diff > 0 ? "+" : "−"}${Math.abs(diff)} ${Math.abs(diff) === 1 ? "ora" : "ore"} rispetto all'Italia)`}
                    </p>
                  )}
                  {stop.daily.length > 0 ? (
                    <ul className="mt-2 grid grid grid-cols-[repeat(auto-fill,minmax(3.6rem,5rem))] gap-1.5 text-center">
                      {stop.daily.map((d) => (
                        <li key={d.date} className="rounded-lg bg-black/[0.04] px-1 py-2">
                          <p className="theme-muted text-xs capitalize">{dayName(d.date)}</p>
                          <p className="text-xl" title={describeWeather(d.code).label}>
                            {describeWeather(d.code).icon}
                          </p>
                          <p className="text-xs font-semibold">{Math.round(d.max)}°</p>
                          <p className="theme-muted text-xs">{Math.round(d.min)}°</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    stop.current && (
                      <p className="mt-1 text-sm">
                        <span className="text-2xl">{describeWeather(stop.current.code).icon}</span>{" "}
                        <strong>{Math.round(stop.current.temp)}°</strong> adesso,{" "}
                        {describeWeather(stop.current.code).label.toLowerCase()}
                      </p>
                    )
                  )}
                </div>
              );
            })}
            {someWithoutForecast && (
              <p className="theme-muted px-4 py-2 text-xs">
                Le previsioni di ogni tappa compaiono una settimana prima: intanto vedi il tempo di adesso sul posto.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
