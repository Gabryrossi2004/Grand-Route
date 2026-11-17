// Prezzi del modello e pacchetti di Zefiro.
//
// COSTO REALE (quanto paga la piattaforma ad Anthropic), modello
// claude-sonnet-5-5: 2 $ ogni milione di token in ingresso, 10 $ ogni milione
// in uscita (i token "di ragionamento" contano come uscita), 0,10 $ per i
// token letti dalla cache. Il cambio dollaro/euro è approssimato: va
// aggiornato ogni tanto.
export const USD_PER_MTOK_INPUT = 2;
export const USD_PER_MTOK_OUTPUT = 10;
export const USD_PER_MTOK_CACHE_READ = 0.1;
export const USD_TO_EUR = 0.92;

export type AiUsageTokens = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

// Prezzi in dollari per milione di token. Per Haiku 5.5 (le domande dei
// clienti a Zefiro) i token letti dalla cache si contano, per prudenza, al
// prezzo pieno di ingresso: il costo mostrato può solo essere un po' più alto
// di quello reale, mai più basso.
export type PricedModel = "sonnet" | "haiku";
const PRICES: Record<PricedModel, { input: number; output: number; cacheRead: number }> = {
  sonnet: { input: USD_PER_MTOK_INPUT, output: USD_PER_MTOK_OUTPUT, cacheRead: USD_PER_MTOK_CACHE_READ },
  haiku: { input: 0.1, output: 0.5, cacheRead: 0.1 },
};

export function costInEuro(usage: AiUsageTokens, model: PricedModel = "sonnet"): number {
  const price = PRICES[model];
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cached = usage.cache_read_input_tokens ?? 0;
  const written = usage.cache_creation_input_tokens ?? 0; // scrittura in cache: 1,25 volte l'ingresso
  const dollars =
    (input * price.input + written * price.input * 1.25 + output * price.output + cached * price.cacheRead) / 1_000_000;
  return dollars * USD_TO_EUR;
}

// PACCHETTI: "disponibilità" giornaliera di Zefiro per agenzia (si azzera a
// mezzanotte, ora italiana). monthlyPriceEur è il prezzo di listino
// consigliato al mese (IVA esclusa); si mostra alle agenzie solo quando
// SHOW_PLAN_PRICES è true, cioè quando il servizio diventa a pagamento.
export type AiPlanId = "start" | "plus" | "pro";

export const AI_PLANS: { id: AiPlanId; name: string; dailyBudgetEur: number; monthlyPriceEur: number; blurb: string }[] = [
  { id: "start", name: "Start", dailyBudgetEur: 2, monthlyPriceEur: 19, blurb: "Per iniziare: qualche viaggio al giorno" },
  { id: "plus", name: "Plus", dailyBudgetEur: 5, monthlyPriceEur: 45, blurb: "Per un'agenzia che lavora con Zefiro ogni giorno" },
  { id: "pro", name: "Pro", dailyBudgetEur: 10, monthlyPriceEur: 99, blurb: "Per team e uso intensivo" },
];

export const SHOW_PLAN_PRICES = false;

export function parseAiPlan(value: unknown): AiPlanId {
  return AI_PLANS.some((p) => p.id === value) ? (value as AiPlanId) : "start";
}

export function planById(id: AiPlanId) {
  return AI_PLANS.find((p) => p.id === id) ?? AI_PLANS[0];
}

export function formatEuro(amount: number) {
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: amount < 1 ? 3 : 2 });
}
