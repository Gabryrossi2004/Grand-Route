"use server";

export type FlightLookupResult = {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalTime: string;
  aircraft: string | null;
};

type AeroDataBoxAirport = {
  iata?: string;
  name?: string;
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

export async function searchFlight(
  flightNumber: string,
  date: string,
): Promise<{ data?: FlightLookupResult[]; error?: string }> {
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
    const flights: AeroDataBoxFlight[] = Array.isArray(json) ? json : [json];

    if (flights.length === 0) {
      return { error: "Nessun volo trovato con questo numero per questa data." };
    }

    const data: FlightLookupResult[] = flights.map((flight) => ({
      airline: flight.airline?.name ?? "",
      flightNumber: flight.number ?? cleanNumber,
      departureAirport: formatAirport(flight.departure?.airport),
      departureTime: formatTime(flight.departure?.scheduledTime?.local),
      arrivalAirport: formatAirport(flight.arrival?.airport),
      arrivalTime: formatTime(flight.arrival?.scheduledTime?.local),
      aircraft: flight.aircraft?.model ?? null,
    }));

    return { data };
  } catch {
    return { error: "Impossibile contattare il servizio di ricerca voli." };
  }
}
