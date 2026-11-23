import { librarySheet } from "@/lib/countrySheetLibrary";
import { nameItOfCode } from "@/lib/geo/countryCodes";
import { photoSrc } from "@/lib/photoSrc";
import { suggestNextWithReason } from "@/lib/nextTrip";
import { TRAVEL_FACTS } from "@/data/travelFacts";
import NextTripShowcase, { type NextTripIdea } from "@/components/NextTripShowcase";

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

// Stagione: dai calendari delle zone (12 lettere, O = ottimo) si ricava se è il momento giusto
function seasonHint(seasons: string[], month: number): { now: boolean; text: string } | null {
  const good = Array.from({ length: 12 }, (_, m) => seasons.some((s) => s[m] === "O"));
  if (!good.some(Boolean)) return null;
  if (good[month]) return { now: true, text: "È il momento perfetto per partire" };
  for (let i = 1; i < 12; i++) {
    const m = (month + i) % 12;
    if (good[m]) return { now: false, text: `Il periodo migliore inizia a ${MONTHS[m]}` };
  }
  return null;
}

// «Il tuo prossimo viaggio»: tre idee dalla libreria in base ai paesi già visitati (senza AI),
// con foto, curiosità, stagione e un itinerario pronto da chiedere all'agenzia.
export default function NextTripCard({ visited }: { visited: string[] }) {
  const picks = suggestNextWithReason(visited, (c) => Boolean(librarySheet(c)?.content.itineraries?.length));
  if (picks.length === 0) return null;
  const month = new Date().getMonth();
  const ideas: NextTripIdea[] = picks.map(({ code, because }) => {
    const { content, photos } = librarySheet(code)!;
    const it = content.itineraries![0];
    const facts = TRAVEL_FACTS[code] ?? [];
    return {
      code,
      name: nameItOfCode(code),
      because: because ? nameItOfCode(because) : null,
      tagline: content.tagline,
      photos: photos.slice(0, 4).map((p) => ({ src: photoSrc(p.url), title: p.title, credit: p.credit, license: p.license, source: p.source })),
      facts: facts.length ? facts : (content.food ?? []).slice(0, 1),
      experiences: (content.experiences ?? []).slice(0, 4).map((e) => e.name),
      bestPeriod: content.facts.bestPeriod,
      flight: content.facts.flight,
      season: seasonHint((content.areas ?? []).map((a) => a.seasons), month),
      itinerary: { title: it.title, days: it.days, route: it.route, description: it.description },
    };
  });
  return <NextTripShowcase ideas={ideas} hasVisited={visited.length > 0} />;
}
