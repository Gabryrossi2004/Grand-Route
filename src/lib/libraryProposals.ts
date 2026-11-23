// Proposte pronte (gratis) dalla libreria: dato un paese o una regione italiana, gli itinerari
// trasformati in programmi giorno per giorno. Usato da «Genera con Zefiro» e dall'Atlante.
import { librarySheet } from "@/lib/countrySheetLibrary";
import { ITALY_REGIONS } from "@/lib/italyLibrary";
import { countryOptions } from "@/lib/geo/countryCodes";
import { expandItinerary, type LibraryItinerary, type PlaceSource } from "@/lib/libraryItinerary";
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
  return null;
}
