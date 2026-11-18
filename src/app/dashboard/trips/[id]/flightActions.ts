"use server";

import { getCachedUser } from "@/lib/supabase/server";

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
