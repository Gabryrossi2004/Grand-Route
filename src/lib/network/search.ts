// Ricerca nella sezione Partner: capisce dalle parole scritte il paese («Giappone») e il tipo di attività
// («guida», «transfer», «hotel»…); le altre parole si cercano in nome, città, descrizione, specialità e lingue.
import { countryOptions, nameItOfCode } from "@/lib/geo/countryCodes";
import type { BusinessKind } from "@/lib/network/kinds";
import type { NetworkRow } from "@/components/network/ProfileCard";

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Parole (già senza accenti) che indicano un tipo di attività
const KIND_WORDS: Record<string, BusinessKind> = {
  guida: "guida", guide: "guida", accompagnatore: "guida", accompagnatori: "guida",
  autista: "autista", autisti: "autista", transfer: "autista", trasferimento: "autista", trasferimenti: "autista", ncc: "autista", driver: "autista", bus: "autista", pullman: "autista", navetta: "autista",
  hotel: "struttura", albergo: "struttura", alberghi: "struttura", struttura: "struttura", strutture: "struttura", alloggio: "struttura", alloggi: "struttura", agriturismo: "struttura", masseria: "struttura", lodge: "struttura", resort: "struttura", villa: "struttura", "b&b": "struttura", bnb: "struttura",
  esperienza: "esperienze", esperienze: "esperienze", escursione: "esperienze", escursioni: "esperienze", attivita: "esperienze", cucina: "esperienze", degustazione: "esperienze", degustazioni: "esperienze", safari: "esperienze",
  agenzia: "agenzia", agenzie: "agenzia",
  operator: "tour_operator", "tour-operator": "tour_operator",
  dmc: "dmc", corrispondente: "dmc", corrispondenti: "dmc",
};

let countryIndex: { name: string; code: string }[] | null = null;
function countries() {
  if (!countryIndex) countryIndex = countryOptions().map((c) => ({ name: norm(c.name), code: c.code })).sort((a, b) => b.name.length - a.name.length);
  return countryIndex;
}

export type ParsedSearch = { words: string[]; country: string | null; kind: BusinessKind | null };

export function parseSearch(q: string): ParsedSearch {
  let text = ` ${norm(q).replace(/[^\p{L}\p{N}&\s-]/gu, " ").replace(/\s+/g, " ")} `;
  let country: string | null = null;
  let kind: BusinessKind | null = null;
  // «tour operator» e «agenzia locale» prima delle parole singole
  if (text.includes(" tour operator ")) { kind = "tour_operator"; text = text.replace(" tour operator ", " "); }
  if (!kind && text.includes(" agenzia locale ")) { kind = "dmc"; text = text.replace(" agenzia locale ", " "); }
  // nomi di paese, anche di più parole («Stati Uniti», «Sri Lanka»): i più lunghi per primi
  for (const c of countries()) {
    if (c.name.length < 3) continue;
    if (text.includes(` ${c.name} `)) { country = c.code; text = text.replace(` ${c.name} `, " "); break; }
  }
  const words: string[] = [];
  for (const w of text.split(" ").filter(Boolean)) {
    if (!kind && KIND_WORDS[w]) { kind = KIND_WORDS[w]; continue; }
    if (["di", "a", "in", "e", "per", "il", "la", "lo", "le", "i", "gli", "del", "della", "con"].includes(w)) continue;
    words.push(w);
  }
  return { words, country, kind };
}

// Tutte le parole rimaste devono comparire in almeno un campo del profilo
export function matchesWords(r: NetworkRow, words: string[]) {
  if (words.length === 0) return true;
  const hay = norm(
    [r.business_name, r.city, r.description, r.tagline ?? "", ...(r.specialties ?? []), ...(r.languages ?? []), nameItOfCode(r.country ?? "")].join(" "),
  );
  return words.every((w) => hay.includes(w));
}
