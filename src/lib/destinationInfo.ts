// Informazioni sulla meta del viaggio per l'area clienti: conto alla
// rovescia, meteo e fuso orario. Il meteo viene da Open-Meteo (servizio
// gratuito, senza chiave): gli si invia SOLO il nome della località, mai
// dati dei clienti. Se il servizio non risponde, la pagina funziona lo stesso.

export type Countdown =
  | { kind: "before"; days: number }
  | { kind: "during"; day: number; total: number }
  | { kind: "after" }
  | null;

// Data di oggi in Italia come "AAAA-MM-GG"
export function romeToday(now = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}

function dayNumber(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function tripCountdown(start: string | null, end: string | null, now = new Date()): Countdown {
  if (!start) return null;
  const today = dayNumber(romeToday(now));
  const first = dayNumber(start);
  const last = end ? dayNumber(end) : first;
  if (today < first) return { kind: "before", days: first - today };
  if (today <= last) return { kind: "during", day: today - first + 1, total: last - first + 1 };
  return { kind: "after" };
}

export function countdownText(c: Countdown): { big: string; small: string } | null {
  if (!c) return null;
  if (c.kind === "before") {
    if (c.days === 1) return { big: "Domani", small: "si parte!" };
    return { big: String(c.days), small: "giorni alla partenza" };
  }
  if (c.kind === "during") return { big: `Giorno ${c.day}`, small: `di ${c.total}: buon viaggio!` };
  return { big: "Bentornato", small: "il viaggio è concluso" };
}

// Differenza oraria tra la meta e l'Italia, in ore (es. +2, -6)
// Si preferisce lo scarto dal UTC dato dal servizio meteo (sempre aggiornato,
// anche per i paesi con regole particolari come il Marocco); in mancanza si
// usano i dati di fuso del sistema.
export function hoursFromItaly(timeZone: string, now = new Date(), utcOffsetSeconds?: number | null): number {
  const offsetHours = (tz: string) => {
    const wall = new Date(now.toLocaleString("en-US", { timeZone: tz }) + " UTC");
    return (wall.getTime() - Math.floor(now.getTime() / 1000) * 1000) / 3_600_000;
  };
  const destination = typeof utcOffsetSeconds === "number" ? utcOffsetSeconds / 3600 : offsetHours(timeZone);
  return Math.round((destination - offsetHours("Europe/Rome")) * 2) / 2;
}

// Ora locale a destinazione, "14:32"
export function localTimeAt(timeZone: string, now = new Date(), utcOffsetSeconds?: number | null): string {
  if (typeof utcOffsetSeconds === "number") {
    const shifted = new Date(now.getTime() + utcOffsetSeconds * 1000);
    return `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
  }
  return now.toLocaleTimeString("it-IT", { timeZone, hour: "2-digit", minute: "2-digit" });
}

// Descrizione e simbolo dei codici meteo (standard WMO)
export function describeWeather(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Sereno", icon: "☀️" };
  if (code <= 2) return { label: "Poco nuvoloso", icon: "🌤️" };
  if (code === 3) return { label: "Coperto", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "Nebbia", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Pioggerella", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Pioggia", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Neve", icon: "❄️" };
  if (code >= 80 && code <= 82) return { label: "Rovesci", icon: "🌦️" };
  if (code === 85 || code === 86) return { label: "Neve", icon: "🌨️" };
  if (code >= 95) return { label: "Temporale", icon: "⛈️" };
  return { label: "Variabile", icon: "🌥️" };
}

export type DestinationInfo = {
  place: string;
  timeZone: string;
  localTime: string; // "14:32"
  hoursFromItaly: number;
  current: { temp: number; code: number } | null;
  daily: { date: string; min: number; max: number; code: number }[];
};

type GeoResult = { name: string; latitude: number; longitude: number; timezone?: string; country?: string };

async function getJson(url: string, revalidate: number): Promise<unknown | null> {
  try {
    const response = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Prima prova il nome intero ("Marrakech, Marocco"), poi la prima parte.
function candidateNames(destination: string): string[] {
  const full = destination.trim();
  const first = full.split(/[,;/\-–]| e | - /i)[0].trim();
  return [...new Set([full, first].filter((n) => n.length >= 2))];
}

export async function loadDestinationInfo(destination: string | null | undefined): Promise<DestinationInfo | null> {
  if (!destination?.trim()) return null;

  let geo: GeoResult | null = null;
  for (const name of candidateNames(destination)) {
    const data = (await getJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=it`,
      60 * 60 * 24 * 30,
    )) as { results?: GeoResult[] } | null;
    if (data?.results?.[0]) {
      geo = data.results[0];
      break;
    }
  }
  if (!geo) return null;

  const forecast = (await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
      `&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=7&timezone=auto`,
    60 * 30,
  )) as {
    timezone?: string;
    utc_offset_seconds?: number;
    current?: { temperature_2m: number; weather_code: number };
    daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
  } | null;

  const timeZone = forecast?.timezone ?? geo.timezone;
  if (!timeZone) return null;

  const now = new Date();
  return {
    place: geo.name,
    timeZone,
    localTime: localTimeAt(timeZone, now, forecast?.utc_offset_seconds),
    hoursFromItaly: hoursFromItaly(timeZone, now, forecast?.utc_offset_seconds),
    current: forecast?.current ? { temp: forecast.current.temperature_2m, code: forecast.current.weather_code } : null,
    daily: forecast?.daily
      ? forecast.daily.time.map((date, i) => ({
          date,
          min: forecast.daily!.temperature_2m_min[i],
          max: forecast.daily!.temperature_2m_max[i],
          code: forecast.daily!.weather_code[i],
        }))
      : [],
  };
}
