"use server";

import { getCachedUser } from "@/lib/supabase/server";
import { CITY_EN, airportCode } from "@/lib/airports";

export type FlightLookupResult = {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  departureDate: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalCity: string;
  arrivalIata: string;
  arrivalDate: string;
  arrivalTime: string;
  aircraft: string | null;
  // Volo con scalo e un solo numero: scali intermedi e numero di tratte (percorso completo)
  stops?: string[];
  legs?: number;
};

type AeroDataBoxAirport = {
  iata?: string;
  name?: string;
  municipalityName?: string;
};

type AeroDataBoxLeg = {
  airport?: AeroDataBoxAirport;
  scheduledTime?: { local?: string };
};

type AeroDataBoxFlight = {
  number?: string;
  departure?: AeroDataBoxLeg;
  arrival?: AeroDataBoxLeg;
  airline?: { name?: string };
  aircraft?: { model?: string };
};

function formatAirport(airport?: AeroDataBoxAirport): string {
  if (!airport) return "";
  return [airport.iata, airport.name].filter(Boolean).join(" – ");
}

function formatTime(local?: string): string {
  // L'orario arriva come "2026-12-15 14:55+01:00": prendiamo solo "14:55".
  return local?.slice(11, 16) ?? "";
}

function formatDate(local?: string): string {
  // Stessa stringa di sopra, ma prendiamo la data "2026-12-15".
  return local?.slice(0, 10) ?? "";
}

export async function searchFlight(
  flightNumber: string,
  date: string,
): Promise<{ data?: FlightLookupResult[]; error?: string }> {
  // Solo per utenti collegati: ogni ricerca consuma il piano a pagamento della ricerca voli
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: ricarica la pagina e accedi di nuovo." };

  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) {
    return { error: "La ricerca voli non è configurata (manca la chiave API)." };
  }

  const cleanNumber = flightNumber.replace(/\s+/g, "").toUpperCase();
  if (!cleanNumber) return { error: "Inserisci un numero di volo." };
  if (!date) return { error: "Imposta prima la data di questo giorno del viaggio." };

  try {
    const res = await fetch(
      `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(cleanNumber)}/${date}`,
      {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
        },
        cache: "no-store",
      },
    );

    if (res.status === 404) {
      return { error: "Nessun volo trovato con questo numero per questa data." };
    }
    if (res.status === 429) {
      return { error: "Hai raggiunto il limite di ricerche del piano gratuito per ora." };
    }
    if (!res.ok) {
      return { error: "Errore durante la ricerca del volo. Riprova." };
    }

    const json = await res.json();
    const rawFlights: AeroDataBoxFlight[] = Array.isArray(json) ? json : [json];

    if (rawFlights.length === 0) {
      return { error: "Nessun volo trovato con questo numero per questa data." };
    }

    type Leg = FlightLookupResult & { depLocal: string; arrLocal: string; depIata: string };
    const toLeg = (flight: AeroDataBoxFlight): Leg => ({
      airline: flight.airline?.name ?? "",
      flightNumber: flight.number ?? cleanNumber,
      departureAirport: formatAirport(flight.departure?.airport),
      departureDate: formatDate(flight.departure?.scheduledTime?.local),
      departureTime: formatTime(flight.departure?.scheduledTime?.local),
      arrivalAirport: formatAirport(flight.arrival?.airport),
      arrivalCity: flight.arrival?.airport?.municipalityName ?? flight.arrival?.airport?.name ?? "",
      arrivalIata: flight.arrival?.airport?.iata ?? "",
      arrivalDate: formatDate(flight.arrival?.scheduledTime?.local),
      arrivalTime: formatTime(flight.arrival?.scheduledTime?.local),
      aircraft: flight.aircraft?.model ?? null,
      depLocal: flight.departure?.scheduledTime?.local ?? "",
      arrLocal: flight.arrival?.scheduledTime?.local ?? "",
      depIata: flight.departure?.airport?.iata ?? "",
    });
    const byDeparture = (a: Leg, b: Leg) => a.depLocal.localeCompare(b.depLocal);
    const everyLeg = rawFlights.map(toLeg).sort(byDeparture);

    // Per i voli con lo stesso numero tutti i giorni (es. un volo giornaliero),
    // l'API può restituire anche l'istanza del giorno precedente (ancora in
    // atterraggio) insieme a quella di oggi: teniamo le tratte che partono
    // esattamente nel giorno cercato...
    const sameDay = everyLeg.filter((leg) => formatDate(leg.depLocal) === date);
    const kept = sameDay.length > 0 ? [...sameDay] : [...everyLeg];

    // ...più le tratte successive dello stesso volo con scalo, anche se ripartono
    // il giorno dopo (si agganciano all'aeroporto in cui è atterrata la tratta precedente,
    // entro 36 ore).
    if (sameDay.length > 0) {
      let extended = true;
      while (extended) {
        extended = false;
        for (const leg of everyLeg) {
          if (kept.includes(leg) || !leg.depIata) continue;
          const previous = kept.find(
            (k) =>
              k.arrivalIata === leg.depIata &&
              leg.depLocal >= k.arrLocal &&
              new Date(leg.depLocal).getTime() - new Date(k.arrLocal).getTime() < 36 * 3600 * 1000,
          );
          if (previous) {
            kept.push(leg);
            extended = true;
          }
        }
      }
      kept.sort(byDeparture);
    }

    // Per i voli già in corso, l'API a volte restituisce due righe per lo
    // stesso volo: una "live" senza l'orario di partenza (perché è già
    // decollato) e una con tutti gli orari completi. Teniamo solo quelle
    // complete, così non si vedono doppioni confusi con l'orario mancante.
    const complete = kept.filter((r) => r.departureTime && r.arrivalTime);
    const candidates = complete.length > 0 ? complete : kept;

    // A volte anche tra i risultati "completi" l'API restituisce due righe
    // praticamente identiche per lo stesso volo (gli orari esatti possono
    // variare di qualche minuto perché i dati live si aggiornano). Teniamo
    // una sola riga per ogni combinazione aeroporto-partenza/aeroporto-arrivo/
    // giorno di arrivo, così non si vede più un doppione da scegliere.
    const seen = new Set<string>();
    const legs = candidates.filter((r) => {
      const key = `${r.departureAirport}|${r.arrivalAirport}|${r.arrivalDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Volo con scalo e un solo numero: oltre alle singole tratte, proponiamo il
    // percorso completo (partenza della prima tratta, arrivo dell'ultima).
    const chain: Leg[] = legs.length > 0 ? [legs[0]] : [];
    for (const leg of legs.slice(1)) {
      if (leg.depIata && leg.depIata === chain[chain.length - 1].arrivalIata) chain.push(leg);
    }
    const strip = ({ depLocal: _d, arrLocal: _a, depIata: _i, ...rest }: Leg): FlightLookupResult => rest;
    const data: FlightLookupResult[] = legs.map(strip);
    if (chain.length >= 2) {
      const first = chain[0];
      const last = chain[chain.length - 1];
      const stops = chain.slice(0, -1).map((leg) => leg.arrivalAirport.split(" – ")[0] || leg.arrivalCity);
      data.unshift({
        ...strip(last),
        departureAirport: first.departureAirport,
        departureTime: first.departureTime,
        aircraft: first.aircraft,
        stops,
        legs: chain.length,
      });
    }

    return { data };
  } catch {
    return { error: "Impossibile contattare il servizio di ricerca voli." };
  }
}

// ── Coincidenza trovata da sola ──────────────────────────────────────────────
// Si leggono le partenze dall'aeroporto dello scalo (stesso servizio AeroDataBox, finestre di 12 ore
// al massimo) e si tengono quelle dirette alla destinazione finale, dando la precedenza alla stessa
// compagnia della prima tratta.
type FidsAirport = { iata?: string; name?: string; municipalityName?: string };
type FidsItem = {
  number?: string;
  airline?: { name?: string };
  aircraft?: { model?: string };
  departure?: { airport?: FidsAirport; scheduledTime?: { local?: string } };
  arrival?: { airport?: FidsAirport; scheduledTime?: { local?: string } };
  movement?: { airport?: FidsAirport; scheduledTime?: { local?: string } };
  codeshareStatus?: string;
};

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();

// "2026-12-15" + "14:55" + minuti → "2026-12-15T15:35" (ora locale dell'aeroporto, senza fuso)
function shiftLocal(date: string, time: string, minutes: number): string {
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

export type ConnectionOption = FlightLookupResult & { wait: string; sameAirline: boolean };

export async function findConnections(input: {
  stopIata: string;
  arrivalDate: string;
  arrivalTime: string;
  destination: string;
  airline?: string;
}): Promise<{ data?: ConnectionOption[]; error?: string }> {
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: ricarica la pagina e accedi di nuovo." };
  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) return { error: "La ricerca voli non è configurata (manca la chiave API)." };

  const stop = input.stopIata.trim().toUpperCase();
  const dest = plain(input.destination);
  if (!/^[A-Z]{3}$/.test(stop)) return { error: "Non conosco l'aeroporto dello scalo: inserisci il numero del secondo volo." };
  if (!dest) return { error: "Scrivi la destinazione finale (es. BKK o Bangkok)." };
  if (!input.arrivalDate || !/^\d{2}:\d{2}$/.test(input.arrivalTime)) return { error: "Manca l'orario di arrivo del primo volo." };

  const matchesDest = (a?: FidsAirport) => {
    if (!a) return false;
    if (dest.length === 3 && a.iata && a.iata.toLowerCase() === dest) return true;
    const destEn = CITY_EN[dest] ?? dest;
    return [a.name, a.municipalityName].some((n) => n && (plain(n).includes(dest) || plain(n).includes(destEn)));
  };

  // Tempo minimo per la coincidenza: 45 minuti dopo l'arrivo; si guarda fino a 24 ore dopo (due finestre)
  const windows: [string, string][] = [
    [shiftLocal(input.arrivalDate, input.arrivalTime, 45), shiftLocal(input.arrivalDate, input.arrivalTime, 45 + 11 * 60 + 59)],
    [shiftLocal(input.arrivalDate, input.arrivalTime, 45 + 12 * 60), shiftLocal(input.arrivalDate, input.arrivalTime, 45 + 23 * 60 + 59)],
  ];
  const found: ConnectionOption[] = [];
  const arrMs = new Date(`${input.arrivalDate}T${input.arrivalTime}:00Z`).getTime();
  const airline = plain(input.airline ?? "");

  try {
    for (const [from, to] of windows) {
      const res = await fetch(
        `https://aerodatabox.p.rapidapi.com/flights/airports/iata/${stop}/${from}/${to}?withLeg=true&direction=Departure&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false`,
        { headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": "aerodatabox.p.rapidapi.com" }, cache: "no-store" },
      );
      if (res.status === 429) return { error: "Hai raggiunto il limite di ricerche del piano per ora." };
      if (res.status === 204 || res.status === 404) continue;
      if (!res.ok) return { error: "Errore durante la ricerca delle coincidenze. Riprova o inserisci il numero del volo." };
      const json = (await res.json()) as { departures?: FidsItem[] };
      for (const f of json.departures ?? []) {
        const arrAirport = f.arrival?.airport ?? f.movement?.airport;
        if (!matchesDest(arrAirport)) continue;
        const depLocal = f.departure?.scheduledTime?.local ?? "";
        const arrLocal = f.arrival?.scheduledTime?.local ?? "";
        if (!depLocal) continue;
        const waitMin = Math.round((new Date(`${depLocal.slice(0, 10)}T${depLocal.slice(11, 16)}:00Z`).getTime() - arrMs) / 60000);
        const name = f.airline?.name ?? "";
        found.push({
          airline: name,
          flightNumber: (f.number ?? "").replace(/\s+/g, ""),
          departureAirport: formatAirport(f.departure?.airport ?? { iata: stop }),
          departureDate: formatDate(depLocal),
          departureTime: formatTime(depLocal),
          arrivalAirport: formatAirport(arrAirport),
          arrivalCity: arrAirport?.municipalityName ?? arrAirport?.name ?? "",
          arrivalIata: arrAirport?.iata ?? "",
          arrivalDate: formatDate(arrLocal),
          arrivalTime: formatTime(arrLocal),
          aircraft: f.aircraft?.model ?? null,
          wait: `${Math.floor(waitMin / 60)} h ${String(waitMin % 60).padStart(2, "0")} min`,
          sameAirline: !!airline && plain(name) === airline,
        });
      }
      // con risultati nella prima finestra non serve guardare il giorno dopo
      if (found.length > 0) break;
    }
  } catch {
    return { error: "Impossibile contattare il servizio di ricerca voli." };
  }

  if (found.length === 0) return { error: "Nessun volo trovato dallo scalo verso questa destinazione nelle 24 ore successive. Prova con il codice dell'aeroporto o inserisci il numero del volo." };
  const unique = found.filter((f, i) => found.findIndex((g) => g.flightNumber === f.flightNumber && g.departureTime === f.departureTime) === i);
  unique.sort((a, b) => Number(b.sameAirline) - Number(a.sameAirline) || (a.departureDate + a.departureTime).localeCompare(b.departureDate + b.departureTime));
  return { data: unique.slice(0, 8) };
}

// ── Ricerca per tratta e data (es. Roma → Delhi il 15/12) ─────────────────────
// Si leggono le partenze dall'aeroporto di partenza nel giorno scelto (due finestre di 12 ore) e si
// tengono i voli diretti verso la destinazione. Per i voli con scalo: si cerca la tratta fino allo
// scalo e poi «Trova la coincidenza».





export async function searchRoute(input: {
  from: string;
  to: string;
  date: string;
}): Promise<{ data?: FlightLookupResult[]; error?: string; fromCode?: string }> {
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: ricarica la pagina e accedi di nuovo." };
  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) return { error: "La ricerca voli non è configurata (manca la chiave API)." };

  const from = airportCode(String(input.from ?? "").slice(0, 60));
  const destText = String(input.to ?? "").slice(0, 60).trim();
  const destCode = /^[A-Za-z]{3}$/.test(destText) ? destText.toUpperCase() : airportCode(destText);
  const dest = plain(destText);
  const destEn = CITY_EN[dest] ?? dest;
  if (!from) return { error: "Non riconosco l'aeroporto di partenza: scrivi la città (es. Roma) o il codice (es. FCO)." };
  if (!dest) return { error: "Scrivi la destinazione (es. Delhi o DEL)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) return { error: "Imposta prima la data di questo giorno del viaggio." };

  const matchesDest = (a?: FidsAirport) => {
    if (!a) return false;
    if (destCode && a.iata && a.iata.toUpperCase() === destCode) return true;
    return [a.name, a.municipalityName].some((n) => n && (plain(n).includes(dest) || plain(n).includes(destEn)));
  };

  const windows: [string, string][] = [
    [`${input.date}T00:00`, `${input.date}T11:59`],
    [`${input.date}T12:00`, `${input.date}T23:59`],
  ];
  const found: FlightLookupResult[] = [];
  try {
    for (const [start, end] of windows) {
      const res = await fetch(
        `https://aerodatabox.p.rapidapi.com/flights/airports/iata/${from}/${start}/${end}?withLeg=true&direction=Departure&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false`,
        { headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": "aerodatabox.p.rapidapi.com" }, cache: "no-store" },
      );
      if (res.status === 429) return { error: "Hai raggiunto il limite di ricerche del piano per ora." };
      if (res.status === 400 || res.status === 404) return { error: `Non trovo l'aeroporto ${from}: controlla il codice.` };
      if (res.status === 204) continue;
      if (!res.ok) return { error: "Errore durante la ricerca dei voli. Riprova." };
      const json = (await res.json()) as { departures?: FidsItem[] };
      for (const f of json.departures ?? []) {
        const arrAirport = f.arrival?.airport ?? f.movement?.airport;
        if (!matchesDest(arrAirport)) continue;
        const depLocal = f.departure?.scheduledTime?.local ?? "";
        const arrLocal = f.arrival?.scheduledTime?.local ?? "";
        if (!depLocal) continue;
        found.push({
          airline: f.airline?.name ?? "",
          flightNumber: (f.number ?? "").replace(/\s+/g, ""),
          departureAirport: formatAirport(f.departure?.airport ?? { iata: from }),
          departureDate: formatDate(depLocal),
          departureTime: formatTime(depLocal),
          arrivalAirport: formatAirport(arrAirport),
          arrivalCity: arrAirport?.municipalityName ?? arrAirport?.name ?? "",
          arrivalIata: arrAirport?.iata ?? "",
          arrivalDate: formatDate(arrLocal),
          arrivalTime: formatTime(arrLocal),
          aircraft: f.aircraft?.model ?? null,
        });
      }
    }
  } catch {
    return { error: "Impossibile contattare il servizio di ricerca voli." };
  }

  if (found.length === 0) {
    return {
      fromCode: from,
      error: `Nessun volo diretto da ${from} verso «${destText}» in questa data. Se serve uno scalo, cerca il volo fino allo scalo (es. ${from} → DOH, DXB, IST, FRA) e poi usa «Trova la coincidenza».`,
    };
  }
  const unique = found.filter((f, i) => found.findIndex((g) => g.flightNumber === f.flightNumber && g.departureTime === f.departureTime) === i);
  unique.sort((a, b) => (a.departureDate + a.departureTime).localeCompare(b.departureDate + b.departureTime));
  return { data: unique.slice(0, 20), fromCode: from };
}
