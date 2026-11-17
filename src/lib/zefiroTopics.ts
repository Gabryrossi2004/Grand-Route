import type { AiPlanId } from "@/lib/aiPricing";

// Gli argomenti su cui Zefiro può rispondere ai clienti, scelti dall'agenzia
// nelle Impostazioni. "Il suo viaggio" è sempre attivo.
export type ZefiroTopicId = "viaggio" | "paese" | "consigli" | "trasporti" | "servizi";

export type ZefiroTopic = {
  id: ZefiroTopicId;
  label: string;
  description: string;
  examples: string[];
  minPlan: AiPlanId; // pacchetto da cui l'argomento è disponibile (se il blocco per pacchetto è attivo)
  alwaysOn?: boolean;
};

export const ZEFIRO_TOPICS: ZefiroTopic[] = [
  {
    id: "viaggio",
    label: "Il suo viaggio",
    description: "Programma, orari, alloggi, pagamenti: i dati che il cliente vede già.",
    examples: ["Cosa faccio domani?", "Dove dormo?"],
    minPlan: "start",
    alwaysOn: true,
  },
  {
    id: "paese",
    label: "Informazioni sul paese",
    description: "Clima e cosa mettere in valigia, usi e costumi, mance, prese elettriche, lingua e frasi utili.",
    examples: ["Cosa mi porto in valigia?", "Si lasciano le mance?"],
    minPlan: "start",
  },
  {
    id: "consigli",
    label: "Consigli sul posto",
    description: "Dove mangiare, cosa fare nel tempo libero, shopping e souvenir, serate.",
    examples: ["Dove posso mangiare bene?", "Cosa faccio nel tempo libero?"],
    minPlan: "plus",
  },
  {
    id: "trasporti",
    label: "Muoversi sul posto",
    description: "Taxi, metro, bus e app utili, come spostarsi in generale.",
    examples: ["Come mi sposto in città?"],
    minPlan: "plus",
  },
  {
    id: "servizi",
    label: "Servizi vicini, con mappa",
    description:
      "Farmacie, ospedali, bancomat, supermercati e ristoranti vicini al cliente, con distanza e link alla mappa (dati OpenStreetMap, non inventati).",
    examples: ["Qual è la farmacia più vicina?", "Dov'è un bancomat?"],
    minPlan: "pro",
  },
];

// Se vero, gli argomenti oltre il pacchetto dell'agenzia restano spenti e le
// Impostazioni mostrano da quale pacchetto sono disponibili. Da portare a true
// quando i pacchetti diventano a pagamento.
export const GATE_TOPICS_BY_PLAN = false;

// Lunghezza massima della "guida dell'agenzia" (consigli scritti a mano)
export const MAX_CLIENT_GUIDE_CHARS = 3000;

const PLAN_RANK: Record<AiPlanId, number> = { start: 0, plus: 1, pro: 2 };

export function isTopicAvailable(topic: ZefiroTopic, plan: AiPlanId): boolean {
  return !GATE_TOPICS_BY_PLAN || PLAN_RANK[plan] >= PLAN_RANK[topic.minPlan];
}

// Argomenti attivi: quelli scelti dall'agenzia (se non ha scelto, tutti),
// limitati dal pacchetto quando il blocco è attivo. "viaggio" c'è sempre.
export function resolveTopics(preferences: Record<string, string> | null | undefined, plan: AiPlanId): ZefiroTopicId[] {
  const saved = preferences?.client_topics;
  const chosen = typeof saved === "string" ? saved.split(",").map((t) => t.trim()) : null;
  return ZEFIRO_TOPICS.filter(
    (topic) => topic.alwaysOn || ((chosen === null || chosen.includes(topic.id)) && isTopicAvailable(topic, plan)),
  ).map((topic) => topic.id);
}

export function guideFor(preferences: Record<string, string> | null | undefined, plan: AiPlanId): string {
  const guide = String(preferences?.client_guide ?? "").trim().slice(0, MAX_CLIENT_GUIDE_CHARS);
  // La guida dell'agenzia fa parte dei "consigli": segue lo stesso blocco per pacchetto
  const consigli = ZEFIRO_TOPICS.find((t) => t.id === "consigli")!;
  return isTopicAvailable(consigli, plan) ? guide : "";
}
