// Luoghi vicini (farmacie, ospedali, bancomat, supermercati, ristoranti) da
// OpenStreetMap tramite il servizio pubblico Overpass: dati reali, senza chiavi.
// Al servizio si inviano SOLO coordinate (arrotondate, circa 100 m) e il tipo di
// luogo, mai nomi o dati dei clienti. Se il servizio non risponde si prosegue
// senza elenco.

export type NearbyCategory = "pharmacy" | "hospital" | "atm" | "supermarket" | "restaurant" | "cafe";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Capisce se la domanda chiede "cosa c'è vicino". Per ristoranti e bar serve
// anche una parola di luogo ("vicino", "zona", "dove"), altrimenti una domanda
// come "cosa è previsto per il pranzo?" farebbe partire una ricerca inutile.
export function detectNearbyCategory(question: string): NearbyCategory | null {
  const q = normalize(question);
  const placeWord = /(vicin|zona|dintorni|qui\b|dove|nei paraggi|intorno|attorno|consigli)/.test(q);
  if (/farmaci/.test(q)) return "pharmacy";
  if (/(ospedal|pronto soccorso|guardia medica|clinica|ambulatorio)/.test(q)) return "hospital";
  if (/(bancomat|\batm\b|prelevare|sportello automatico)/.test(q)) return "atm";
  if (/(supermerc|minimarket|negozio di alimentari|alimentari)/.test(q)) return "supermarket";
  if (placeWord && /(ristorant|trattoria|pizzeria|mangiare|cenare|pranzare|osteria)/.test(q)) return "restaurant";
  if (placeWord && /(caffe|colazione|\bbar\b|cappuccino)/.test(q)) return "cafe";
  return null;
}

const SETTINGS: Record<NearbyCategory, { label: string; single: string; filter: string; radius: number }> = {
  pharmacy: { label: "Farmacie", single: "Farmacia", filter: '["amenity"="pharmacy"]', radius: 3000 },
  hospital: { label: "Ospedali e cliniche", single: "Ospedale o clinica", filter: '["amenity"~"^(hospital|clinic)$"]', radius: 6000 },
  atm: { label: "Bancomat", single: "Bancomat", filter: '["amenity"="atm"]', radius: 1500 },
  supermarket: { label: "Supermercati e alimentari", single: "Negozio di alimentari", filter: '["shop"~"^(supermarket|convenience)$"]', radius: 1500 },
  restaurant: { label: "Ristoranti", single: "Ristorante", filter: '["amenity"="restaurant"]', radius: 1000 },
  cafe: { label: "Bar e caffè", single: "Bar", filter: '["amenity"="cafe"]', radius: 1000 },
};

export type NearbyPlace = {
  name: string;
  distanceM: number;
  lat: number;
  lon: number;
  detail: string | null; // tipo di cucina o orari, se indicati nella mappa
  mapUrl: string;
};

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export function parseOverpass(elements: OverpassElement[], lat: number, lon: number, category: NearbyCategory): NearbyPlace[] {
  const single = SETTINGS[category].single;
  return elements
    .map((el) => {
      const eLat = el.lat ?? el.center?.lat;
      const eLon = el.lon ?? el.center?.lon;
      if (typeof eLat !== "number" || typeof eLon !== "number") return null;
      const tags = el.tags ?? {};
      const name = tags["name:it"] || tags.name || tags.brand || `${single} (senza nome sulla mappa)`;
      const detail = [tags.cuisine ? `cucina: ${tags.cuisine.replace(/;/g, ", ")}` : "", tags.opening_hours ? `orari sulla mappa: ${tags.opening_hours}` : ""]
        .filter(Boolean)
        .join("; ");
      return {
        name,
        distanceM: distanceMeters(lat, lon, eLat, eLon),
        lat: eLat,
        lon: eLon,
        detail: detail || null,
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${eLat},${eLon}`,
      } satisfies NearbyPlace;
    })
    .filter((p): p is NearbyPlace => p !== null)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 5);
}

export async function fetchNearby(lat: number, lon: number, category: NearbyCategory): Promise<NearbyPlace[] | null> {
  const { filter, radius } = SETTINGS[category];
  const query = `[out:json][timeout:8];nwr${filter}(around:${radius},${lat},${lon});out center 40;`;
  try {
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "GrandRoute/1.0 (grandroute.it)" },
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { elements?: OverpassElement[] };
    return parseOverpass(data.elements ?? [], lat, lon, category);
  } catch {
    return null;
  }
}

const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

// Il blocco di testo che Zefiro legge: solo ciò che è davvero sulla mappa.
export function formatNearby(
  category: NearbyCategory,
  places: NearbyPlace[] | null,
  originLabel: string,
): string {
  const { label, radius } = SETTINGS[category];
  if (places === null) {
    return `RICERCA SULLA MAPPA NON DISPONIBILE in questo momento (${label}). Non inventare luoghi: dillo al cliente e suggerisci di cercare su Google Maps.`;
  }
  if (places.length === 0) {
    return `RISULTATO DELLA MAPPA (OpenStreetMap) — ${label}, punto di partenza: ${originLabel}. Nessun risultato entro ${formatDistance(radius)}. Non inventare luoghi: suggerisci di cercare su Google Maps o di chiedere all'agenzia.`;
  }
  const rows = places.map(
    (p, i) => `  ${i + 1}. ${p.name} — a circa ${formatDistance(p.distanceM)}${p.detail ? ` (${p.detail})` : ""} — mappa: ${p.mapUrl}`,
  );
  return `RISULTATO DELLA MAPPA (OpenStreetMap) — ${label}, dal più vicino. Punto di partenza: ${originLabel}.\n${rows.join("\n")}\n(Elenco reale ma non garantito: orari e apertura da verificare. Non aggiungere luoghi che non sono in elenco.)`;
}
