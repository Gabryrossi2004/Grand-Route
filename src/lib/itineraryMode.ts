import type { GeneratedItinerary } from "@/lib/itineraryAi";

// Itinerario "per giornata intera": ogni giorno è un solo blocco di testo che elenca tutte
// le attività (a differenza di "per attività", con una scheda per ciascuna).
export type ItineraryMode = "activities" | "days";

export const parseMode = (value: unknown): ItineraryMode => (value === "days" ? "days" : "activities");

// Titolo (interno) dell'unica attività che contiene il blocco del giorno
export const DAY_BLOCK_TITLE = "Programma della giornata";

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type BlockActivity = GeneratedItinerary["days"][number]["activities"][number];

// Trasforma le attività di un giorno in un elenco HTML: orario e titolo in grassetto, poi la descrizione.
export function activitiesToBlockHtml(activities: BlockActivity[]): string {
  if (activities.length === 0) return "";
  const items = activities.map((a) => {
    const time = a.start_time ? `<strong>${esc(a.start_time.slice(0, 5))}</strong> ` : "";
    const where = a.location ? ` <em>(${esc(a.location)})</em>` : "";
    const desc = a.description ? ` — ${esc(a.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())}` : "";
    return `<li>${time}<strong>${esc(a.title)}</strong>${where}${desc}</li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}
