// Proposte pronte (gratis) dalla libreria: dato un paese o una regione italiana, gli itinerari
// trasformati in programmi giorno per giorno. Usato da «Genera con Zefiro» e dall'Atlante.
import { librarySheet } from "@/lib/countrySheetLibrary";
import { ITALY_REGIONS } from "@/lib/italyLibrary";
import { countryOptions } from "@/lib/geo/countryCodes";
import { expandItinerary, parseRoute, type LibraryItinerary, type PlaceSource } from "@/lib/libraryItinerary";
import type { GeneratedItinerary } from "@/lib/itineraryAi";

export type LibraryProposal = {
  title: string;
  route: string;
  description: string;
  days: number;
  itinerary: GeneratedItinerary;
};

export type LibraryMatch = { kind: "country" | "italy"; key: string; label: string; proposals: LibraryProposal[] };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function countrySource(code: string): { src: PlaceSource; list: LibraryItinerary[] } | null {
  const sheet = librarySheet(code)?.content;
  if (!sheet) return null;
  return {
    src: {
      places: sheet.places ?? [],
      areas: (sheet.areas ?? []).map((a) => ({ name: a.name, description: a.description, highlights: a.highlights ?? [] })),
      experiences: sheet.experiences ?? [],
      domestic: code === "IT",
    },
    list: (sheet.itineraries ?? []) as LibraryItinerary[],
  };
}

function italySource(id: string): { src: PlaceSource; list: LibraryItinerary[] } | null {
  const r = ITALY_REGIONS[id];
  if (!r) return null;
  return {
    src: {
      places: r.places,
      areas: r.zones.map((z) => ({ name: `${z.name} ${z.tagline}`, description: z.description[0] ?? "", highlights: z.highlights })),
      experiences: r.experiences.map((e) => ({ name: e, description: "" })),
      domestic: true,
    },
    list: (r.itineraries ?? []) as LibraryItinerary[],
  };
}

function toProposals(data: { src: PlaceSource; list: LibraryItinerary[] } | null): LibraryProposal[] {
  if (!data) return [];
  return data.list.map((it) => {
    const itinerary = expandItinerary(it, data.src);
    return { title: it.title, route: it.route, description: it.description, days: itinerary.days.length, itinerary };
  });
}

// Un singolo itinerario (anche di una scheda personalizzata dall'agenzia) trasformato in programma
export function expandLibraryItinerary(kind: "country" | "italy", key: string, it: LibraryItinerary): GeneratedItinerary {
  const data = kind === "italy" ? italySource(key) : countrySource(key);
  const src: PlaceSource = data?.src ?? { places: [], areas: [], experiences: [], domestic: kind === "italy" };
  return expandItinerary(it, src);
}

export function libraryProposalsFor(kind: "country" | "italy", key: string): LibraryProposal[] {
  return toProposals(kind === "italy" ? italySource(key) : countrySource(key));
}

// Dal testo della destinazione o della richiesta (es. «Giappone», «10 giorni in Sicilia») alla libreria giusta.
// Si cercano parole intere, così «romantico» non diventa «Oman».
export function matchLibrary(text: string): LibraryMatch | null {
  const d = ` ${norm(text).replace(/[^a-z0-9]+/g, " ")} `;
  if (d.trim().length < 3) return null;
  const has = (name: string) => {
    const n = norm(name).replace(/[^a-z0-9]+/g, " ").trim();
    return n.length >= 3 && d.includes(` ${n} `);
  };
  for (const [id, r] of Object.entries(ITALY_REGIONS)) {
    if (has(r.name)) return { kind: "italy", key: id, label: r.name, proposals: libraryProposalsFor("italy", id) };
  }
  const options = [...countryOptions()].sort((a, b) => b.name.length - a.name.length);
  const hit = options.find((c) => has(c.name));
  if (hit) {
    const proposals = libraryProposalsFor("country", hit.code);
    if (proposals.length) return { kind: "country", key: hit.code, label: hit.name, proposals };
  }
  // Nessun paese nominato: si cercano i luoghi famosi delle tappe (es. «Petra e Wadi Rum» → Giordania)
  // I nomi di una sola parola contano solo se scritti con la maiuscola («Alba», non «all'alba»)
  const capitalized = new Set(
    (text.match(/\p{Lu}[\p{L}'’-]*/gu) ?? []).map((w) => norm(w).replace(/[^a-z0-9]+/g, " ").trim()),
  );
  const score = new Map<string, number>();
  for (const [name, key] of placeIndex()) {
    if (!d.includes(` ${name} `)) continue;
    if (!name.includes(" ") && !capitalized.has(name)) continue;
    score.set(key, (score.get(key) ?? 0) + 1);
  }
  const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best) {
    const [kind, key] = best[0].split(":") as ["country" | "italy", string];
    const proposals = libraryProposalsFor(kind, key);
    const label = kind === "italy" ? ITALY_REGIONS[key]?.name : countryOptions().find((c) => c.code === key)?.name;
    if (proposals.length && label) return { kind, key, label, proposals };
  }
  return null;
}

// Nomi delle tappe degli itinerari e dei luoghi delle schede. Se un nome compare in più paesi (es. Bora
// Bora nei combinati Polinesia + Isole Cook) vince il paese che lo ha tra i propri luoghi o che lo usa
// più spesso; i pareggi e le parole generiche («Mare», «Relax») si scartano. Costruito una volta sola.
const GENERIC = new Set(["mare", "relax", "spiaggia", "partenza", "arrivo", "interno", "crociera", "nord", "sud", "est", "ovest", "centro", "costa", "isole", "laguna", "giornata libera", "rientro", "deserto", "montagna", "lago", "fiume", "safari", "capitale", "citta", "grotte", "laghi", "templi", "cantine", "capo", "porto", "natura", "sole", "luna", "vino"]);
let PLACE_INDEX: [string, string][] | null = null;
function placeIndex(): [string, string][] {
  if (PLACE_INDEX) return PLACE_INDEX;
  const weights = new Map<string, Map<string, number>>();
  const add = (raw: string, key: string, weight: number) => {
    for (const part of raw.split(/\s+(?:e|o)\s+|\/|,/)) {
      // «Bali mare», «Bali sud» → «Bali»
      const n = norm(part).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w, i, all) => i === 0 || !GENERIC.has(w) || i < all.length - 1).join(" ");
      if (n.length < 4 || GENERIC.has(n) || /^\d/.test(n)) continue;
      if (!weights.has(n)) weights.set(n, new Map());
      const w = weights.get(n)!;
      w.set(key, (w.get(key) ?? 0) + weight);
    }
  };
  const countryNames = new Set(countryOptions().map((c) => norm(c.name)));
  for (const c of countryOptions()) {
    const data = c.code === "IT" ? null : countrySource(c.code);
    if (!data) continue;
    for (const it of data.list) for (const stop of parseRoute(it.route)) add(stop.name, `country:${c.code}`, 1);
    for (const p of data.src.places) add(p.name, `country:${c.code}`, 5);
    for (const a of data.src.areas) add(a.name, `country:${c.code}`, 5);
  }
  for (const id of Object.keys(ITALY_REGIONS)) {
    const data = italySource(id);
    if (!data) continue;
    for (const it of data.list) for (const stop of parseRoute(it.route)) add(stop.name, `italy:${id}`, 1);
    for (const p of data.src.places) add(p.name, `italy:${id}`, 5);
  }
  const out: [string, string][] = [];
  for (const [n, w] of weights) {
    if (countryNames.has(n)) continue;
    const ranked = [...w.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) continue;
    out.push([n, ranked[0][0]]);
  }
  PLACE_INDEX = out;
  return PLACE_INDEX;
}
