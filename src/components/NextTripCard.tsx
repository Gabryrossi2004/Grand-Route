import { librarySheet } from "@/lib/countrySheetLibrary";
import { suggestNextWithReason } from "@/lib/nextTrip";
import { destinationDetail, destinationLite, destinationPool, type DestinationLite, type NextTripIdea } from "@/lib/nextTripData";
import NextTripShowcase from "@/components/NextTripShowcase";

// «Il tuo prossimo viaggio»: le idee scelte in base ai paesi già visitati (senza AI) e un
// esploratore di tutte le mete con filtri, «Sorprendimi», sogni salvati e il gioco «Indovina la meta».
export default function NextTripCard({ visited }: { visited: string[] }) {
  const pool = destinationPool();
  const picks = suggestNextWithReason(visited, (c) => pool.includes(c) && Boolean(librarySheet(c)?.content.itineraries?.length));
  const ideas = picks.map((p) => destinationDetail(p.code, p.because)).filter((x): x is NextTripIdea => Boolean(x));
  if (ideas.length === 0) return null;
  const seen = new Set(visited.map((c) => c.toUpperCase()));
  const lite = pool
    .filter((c) => !seen.has(c))
    .map(destinationLite)
    .filter((x): x is DestinationLite => Boolean(x))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  return <NextTripShowcase ideas={ideas} pool={lite} hasVisited={visited.length > 0} />;
}
