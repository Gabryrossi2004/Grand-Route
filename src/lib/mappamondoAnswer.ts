// «Chiedi al Mappamondo»: risposte per l'agenzia dalle schede paese e dalle guide della libreria,
// senza AI. Riconosce il paese (o una zona, es. «Zanzibar» → Tanzania) e l'argomento della domanda.

import { LIBRARY_CODES, librarySheet } from "@/lib/countrySheetLibrary";
import { MONTHS_LONG } from "@/lib/countrySheetShared";
import { answerFromCountries, bestMatch, normalize, type FaqItem } from "@/lib/zefiroLocal";

const itNames = new Intl.DisplayNames(["it"], { type: "region" });
const enNames = new Intl.DisplayNames(["en"], { type: "region" });

type Hit = { code: string; area?: string };
let INDEX: { key: string; hit: Hit }[] | null = null;

// Nomi da riconoscere: paesi in italiano e inglese, alcuni nomi comuni, zone delle guide
function index() {
  if (INDEX) return INDEX;
  const list: { key: string; hit: Hit }[] = [];
  const add = (name: string | undefined, hit: Hit) => {
    const key = normalize(name ?? "");
    if (key.length >= 4 && !list.some((x) => x.key === key)) list.push({ key, hit });
  };
  const ALIASES: Record<string, string[]> = {
    US: ["america", "usa", "stati uniti"],
    GB: ["inghilterra", "scozia", "londra", "regno unito"],
    AE: ["dubai", "abu dhabi", "emirati"],
    NL: ["olanda"],
    CZ: ["praga", "repubblica ceca"],
    KR: ["corea"],
    MV: ["maldive"],
    PF: ["polinesia", "tahiti", "bora bora"],
    TZ: ["zanzibar"],
    ES: ["baleari", "canarie", "ibiza", "maiorca", "tenerife"],
    PT: ["madeira", "azzorre"],
    GR: ["santorini", "mykonos", "creta"],
    MU: ["mauritius"],
    DO: ["santo domingo", "punta cana"],
  };
  const GENERIC = new Set(["nord", "sud", "est", "ovest", "sud ovest", "sud est", "nord ovest", "nord est", "centro", "costa", "interno", "foreste", "montagne", "montagna", "riserve", "continente", "oriente", "mare", "altopiano", "isole", "laghi", "deserto"]);
  // Precedenza: nomi dei paesi, poi zone delle guide, poi nomi comuni
  for (const code of LIBRARY_CODES) {
    add(itNames.of(code), { code });
    add(enNames.of(code), { code });
  }
  for (const code of LIBRARY_CODES) {
    for (const area of librarySheet(code)?.content.areas ?? []) {
      // "Isole Andamane (Phuket, Krabi)": il nome principale e quelli tra parentesi
      const main = area.name.split("(")[0];
      const inside = (area.name.match(/\(([^)]+)\)/)?.[1] ?? "").split(/,| e /);
      for (const n of [main, ...inside]) if (!GENERIC.has(normalize(n))) add(n.trim(), { code, area: area.name });
    }
  }
  for (const code of LIBRARY_CODES) for (const a of ALIASES[code] ?? []) add(a, { code });
  list.sort((a, b) => b.key.length - a.key.length);
  INDEX = list;
  return list;
}

export function findPlace(question: string): Hit | null {
  const q = ` ${normalize(question)} `;
  for (const { key, hit } of index()) if (q.includes(` ${key} `)) return hit;
  return null;
}

const monthsList = (seasons: string, level: string) =>
  [...seasons].map((c, i) => (c.toUpperCase() === level ? MONTHS_LONG[i] : null)).filter(Boolean).join(", ");

export type MappamondoAnswer = { answer: string; source: "faq" | "paese" | "memoria"; country?: string };

export function answerAgencyQuestion(question: string, extra: { faqs: FaqItem[]; memory: FaqItem[] }): MappamondoAnswer | null {
  const faq = bestMatch(question, extra.faqs, 0.6);
  if (faq) return { answer: faq.answer, source: "faq" };

  const place = findPlace(question);
  const q = normalize(question);
  if (place) {
    const sheet = librarySheet(place.code)?.content;
    const name = itNames.of(place.code) ?? place.code;
    // Periodo per una zona precisa: dalla tabella «Quando andare»
    if (sheet && /\b(quando|periodo|stagione|mesi|clima|monsoni?|piogge)\b/.test(q)) {
      const area = sheet.areas?.find((a) => a.name === place.area) ?? null;
      if (area) {
        const best = monthsList(area.seasons, "O");
        const bad = monthsList(area.seasons, "X");
        return {
          answer: `${area.name} (${name}): ${area.seasonNote}${best ? `\nMesi ottimi: ${best}.` : ""}${bad ? `\nSconsigliati: ${bad}.` : ""}`,
          source: "paese",
          country: place.code,
        };
      }
      if (sheet.areas?.length) {
        const lines = sheet.areas.map((a) => `• ${a.name}: ${a.seasonNote}`);
        return { answer: `${name} — periodo migliore: ${sheet.facts.bestPeriod}.\n${lines.join("\n")}`, source: "paese", country: place.code };
      }
    }
    // Documenti: per l'agenzia anche i consigli riservati
    if (sheet && /\b(document|passaport|visto|visti|esta|eta|ingresso|vaccin)/.test(q)) {
      const tips = (sheet.agentTips ?? []).filter((t) => /visto|eta|esta|passaport|document|ingresso|vaccin|febbre gialla|autorizzazion/i.test(t));
      return { answer: `${name}: ${sheet.facts.documents}${tips.length ? `\n${tips.map((t) => `• ${t}`).join("\n")}` : ""}`, source: "paese", country: place.code };
    }
    if (sheet && /\b(itinerari|itinerario|quanti giorni|tour|giro)\b/.test(q) && sheet.itineraries?.length) {
      return {
        answer: `${name} — itinerari consigliati:\n${sheet.itineraries.map((i) => `• ${i.title} (${i.days} giorni): ${i.route}`).join("\n")}`,
        source: "paese",
        country: place.code,
      };
    }
    if (sheet && /\b(cosa fare|esperienz|attivita)\b/.test(q) && sheet.experiences?.length) {
      return { answer: `${name} — cosa fare:\n${sheet.experiences.slice(0, 8).map((e) => `• ${e.name}: ${e.description}`).join("\n")}`, source: "paese", country: place.code };
    }
    if (sheet && /\b(consigli|attenzione|errori|cosa sapere)\b/.test(q) && sheet.agentTips?.length) {
      return { answer: `${name} — consigli per l'agente:\n${sheet.agentTips.map((t) => `• ${t}`).join("\n")}`, source: "paese", country: place.code };
    }
    const general = answerFromCountries(question, [place.code]);
    if (general) return { answer: `${name}: ${general}`, source: "paese", country: place.code };
  }

  const remembered = bestMatch(question, extra.memory, 0.75);
  if (remembered) return { answer: remembered.answer, source: "memoria" };
  return null;
}
