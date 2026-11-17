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

export type Forecast = { date: string; min: number; max: number; code: number };

// Una tappa del viaggio: una località con i giorni che ci si trascorre
export type StopInfo = {
  place: string;
  country: string | null;
  latitude: number;
  longitude: number;
  firstDay: number; // numero del giorno (1, 2, ...)
  lastDay: number;
  from: string | null; // date AAAA-MM-GG
  to: string | null;
  timeZone: string;
  localTime: string; // "14:32"
  hoursFromItaly: number;
  current: { temp: number; code: number } | null;
  daily: Forecast[]; // previsioni per i giorni della tappa (solo se rientrano nei prossimi 7)
};

export type DayInput = {
  date: string | null;
  title: string | null;
  places: { location: string | null; type?: string | null }[];
};

type GeoResult = {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  feature_code?: string;
};

async function getJson(url: string, revalidate: number): Promise<unknown | null> {
  try {
    const response = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Nomi di luogo possibili ricavati da un testo libero ("Riad Jasmine, Derb X, Marrakech"):
// prima l'ultima parte (di solito la città), poi le altre, anche senza "Aeroporto di".
export function placeCandidates(text: string | null | undefined): string[] {
  if (!text) return [];
  // Tolgo le parentesi e i CAP ("40000 Marrakech" → "Marrakech")
  const cleaned = text
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d{3,6}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const out: string[] = [];
  const add = (value: string) => {
    const v = value.trim().replace(/^[-–\s]+|[-–\s]+$/g, "");
    if (v.length >= 3 && !/\d/.test(v) && !out.includes(v)) out.push(v);
  };
  for (const segment of cleaned.split(",").reverse()) {
    add(segment);
    const afterPreposition = segment.match(/\b(?:di|a|ad|in|da)\s+([^,]+)$/i);
    if (afterPreposition) {
      add(afterPreposition[1]);
      // "Marrakech-Menara" → anche "Marrakech"
      for (const part of afterPreposition[1].split(/\s?[-–]\s?/)) add(part);
    }
    for (const part of segment.split(/\s?[-–]\s?/)) if (part !== segment) add(part);
  }
  return out.slice(0, 8);
}

// "Arrivo a Marrakech" → "Marrakech" (nomi propri dopo a / in / per / verso)
export function titleHints(title: string | null | undefined): string[] {
  if (!title) return [];
  const re = /\b(?:a|ad|in|per|verso|da|di)\s+((?:[A-ZÀ-Ý][\p{L}'’]+)(?:[ -][A-ZÀ-Ý][\p{L}'’]+){0,2})/gu;
  return [...title.matchAll(re)].map((m) => m[1]).slice(0, 3);
}

// Per ogni giorno, i nomi da provare: prima il titolo ("Arrivo a Marrakech"), poi
// le località delle attività (gli alloggi per primi).
export function dayCandidates(day: DayInput): string[] {
  const ordered = [...day.places].sort((a, b) => (a.type === "alloggio" ? -1 : 0) - (b.type === "alloggio" ? -1 : 0));
  const all = [...titleHints(day.title), ...ordered.flatMap((p) => placeCandidates(p.location))];
  return [...new Set(all)].slice(0, 8);
}

function countryMatches(hint: string, country: string | undefined) {
  if (!hint) return true;
  if (!country) return false;
  return hint.includes(normalize(country));
}

const PLACE_CODES = /^(PPL|ADM|PCL)/;

async function geocode(name: string, countryHint: string): Promise<GeoResult | null> {
  const data = (await getJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=it`,
    60 * 60 * 24 * 30,
  )) as { results?: GeoResult[] } | null;
  return (
    data?.results?.find(
      (r) => (!r.feature_code || PLACE_CODES.test(r.feature_code)) && countryMatches(countryHint, r.country),
    ) ?? null
  );
}

type Forecasted = {
  timeZone: string;
  utcOffsetSeconds: number | null;
  current: { temp: number; code: number } | null;
  daily: Forecast[];
};

async function loadForecast(geo: GeoResult): Promise<Forecasted | null> {
  const data = (await getJson(
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
  const timeZone = data?.timezone ?? geo.timezone;
  if (!timeZone) return null;
  return {
    timeZone,
    utcOffsetSeconds: data?.utc_offset_seconds ?? null,
    current: data?.current ? { temp: data.current.temperature_2m, code: data.current.weather_code } : null,
    daily: data?.daily
      ? data.daily.time.map((date, i) => ({
          date,
          min: data.daily!.temperature_2m_min[i],
          max: data.daily!.temperature_2m_max[i],
          code: data.daily!.weather_code[i],
        }))
      : [],
  };
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Le tappe del viaggio con il loro meteo. Le località si ricavano dall'itinerario
// (titoli dei giorni e luoghi delle attività), non dal titolo del viaggio, che
// spesso è solo la nazione. Se non se ne trova nessuna si usa la destinazione.
export async function loadTripStops(
  destination: string | null | undefined,
  startDate: string | null,
  days: DayInput[],
): Promise<StopInfo[]> {
  const countryHint = normalize(destination ?? "");
  const geoCache = new Map<string, Promise<GeoResult | null>>();
  const geocodeOnce = (name: string, hint: string) => {
    const key = `${hint}|${name}`;
    if (!geoCache.has(key)) geoCache.set(key, geocode(name, hint));
    return geoCache.get(key)!;
  };

  // 1. Località di ogni giorno (i giorni si risolvono in parallelo)
  const perDay = await Promise.all(
    days.map(async (day) => {
      for (const name of dayCandidates(day)) {
        const geo = await geocodeOnce(name, countryHint);
        if (geo) return geo;
      }
      return null;
    }),
  );

  // 2. Giorni consecutivi nello stesso posto = una tappa (un giorno senza
  // località segue la tappa precedente)
  type Group = { geo: GeoResult; firstDay: number; lastDay: number };
  const groups: Group[] = [];
  perDay.forEach((geo, index) => {
    const last = groups[groups.length - 1];
    if (!geo) {
      if (last) last.lastDay = index + 1;
      return;
    }
    if (last && last.geo.latitude === geo.latitude && last.geo.longitude === geo.longitude) {
      last.lastDay = index + 1;
    } else {
      groups.push({ geo, firstDay: index + 1, lastDay: index + 1 });
    }
  });

  // 3. Senza località nell'itinerario: la destinazione del viaggio
  if (groups.length === 0) {
    const names = (destination ?? "")
      .trim()
      .split(/[,;/\-–]| e | - /i)
      .map((n) => n.trim())
      .filter((n) => n.length >= 2);
    for (const name of [(destination ?? "").trim(), ...names]) {
      if (!name) continue;
      const geo = await geocodeOnce(name, "");
      if (geo) {
        groups.push({ geo, firstDay: 1, lastDay: Math.max(1, days.length) });
        break;
      }
    }
  }

  const limited = groups.slice(0, 6);
  const now = new Date();
  const stops = await Promise.all(
    limited.map(async (group): Promise<StopInfo | null> => {
      const forecast = await loadForecast(group.geo);
      if (!forecast) return null;
      const dateOf = (dayNumber: number) => {
        const own = days[dayNumber - 1]?.date;
        if (own) return own.slice(0, 10);
        return startDate ? addDays(startDate, dayNumber - 1) : null;
      };
      const from = dateOf(group.firstDay);
      const to = dateOf(group.lastDay);
      return {
        place: group.geo.name,
        country: group.geo.country ?? null,
        latitude: group.geo.latitude,
        longitude: group.geo.longitude,
        firstDay: group.firstDay,
        lastDay: group.lastDay,
        from,
        to,
        timeZone: forecast.timeZone,
        localTime: localTimeAt(forecast.timeZone, now, forecast.utcOffsetSeconds),
        hoursFromItaly: hoursFromItaly(forecast.timeZone, now, forecast.utcOffsetSeconds),
        current: forecast.current,
        daily: from && to ? forecast.daily.filter((d) => d.date >= from && d.date <= to) : [],
      };
    }),
  );
  return stops.filter((s): s is StopInfo => s !== null);
}
