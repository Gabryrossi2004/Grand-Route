import type { Trip } from "@/lib/types";
import {
  countdownText,
  describeWeather,
  loadDestinationInfo,
  romeToday,
  tripCountdown,
  type DestinationInfo,
} from "@/lib/destinationInfo";

function dayName(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { weekday: "short" });
}

// Riquadro in cima al viaggio, nell'area clienti: conto alla rovescia, ora e
// meteo nella località di destinazione.
export default async function TripGlance({ trip }: { trip: Trip }) {
  const info = await loadDestinationInfo(trip.destination);
  return <TripGlanceView trip={trip} info={info} />;
}

export function TripGlanceView({
  trip,
  info,
}: {
  trip: Pick<Trip, "start_date" | "end_date">;
  info: DestinationInfo | null;
}) {
  const countdown = countdownText(tripCountdown(trip.start_date, trip.end_date));
  if (!countdown && !info) return null;

  // Previsioni: i giorni del viaggio se sono nei prossimi 7, altrimenti i prossimi giorni
  const today = romeToday();
  const inTrip = info?.daily.filter(
    (d) => d.date >= (trip.start_date ?? today) && d.date <= (trip.end_date ?? trip.start_date ?? today),
  );
  const forecast = (inTrip && inTrip.length > 0 ? inTrip : (info?.daily ?? [])).slice(0, 5);
  const showsTripDays = Boolean(inTrip && inTrip.length > 0);
  const diff = info?.hoursFromItaly ?? 0;

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
        {info && (
          <div className="min-w-0 flex-1 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="theme-heading-font text-base font-semibold">{info.place}</p>
              <p className="theme-muted text-sm">
                Lì sono le <strong className="text-current">{info.localTime}</strong>
                {diff === 0 ? " (stessa ora dell'Italia)" : ` (${diff > 0 ? "+" : "−"}${Math.abs(diff)} ${Math.abs(diff) === 1 ? "ora" : "ore"} rispetto all'Italia)`}
              </p>
            </div>
            {info.current && (
              <p className="mt-1 text-sm">
                <span className="text-2xl">{describeWeather(info.current.code).icon}</span>{" "}
                <strong>{Math.round(info.current.temp)}°</strong> adesso, {describeWeather(info.current.code).label.toLowerCase()}
              </p>
            )}
            {forecast.length > 0 && (
              <>
                <ul className="mt-3 grid grid-cols-5 gap-1.5 text-center">
                  {forecast.map((d) => (
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
                <p className="theme-muted mt-2 text-xs">
                  {showsTripDays ? "Previsioni per i giorni del tuo viaggio." : "Previsioni dei prossimi giorni sul posto: quelle del viaggio compariranno una settimana prima della partenza."}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
