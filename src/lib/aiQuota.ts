import { createClient, getCachedUser } from "@/lib/supabase/server";
import { costInEuro, formatEuro, parseAiPlan, planById, type AiPlanId, type AiUsageTokens } from "@/lib/aiPricing";

// Limiti d'uso delle funzioni AI (generazione itinerario, lettura listini,
// lettura richieste dei clienti). Ogni chiamata costa denaro: questi tetti
// evitano che un uso eccessivo o un abuso faccia salire la bolletta.
// Contano insieme tutte e tre le funzioni, per ogni singolo utente.
// Per cambiare i limiti basta modificare i numeri qui sotto.
const MAX_CALLS_PER_HOUR = 12;
const MAX_CALLS_PER_DAY = 40;

// Lunghezza massima del testo che si può dare in pasto all'AI.
export const MAX_DRAFT_CHARS = 60_000;
export const MAX_PRICE_LIST_CHARS = 150_000;

export type AiKind = "itinerary" | "client_request" | "price_list" | "review" | "rules_test" | "message_draft" | "translation";

export function tooLongMessage(maxChars: number) {
  return `Il testo è troppo lungo (massimo circa ${Math.round(maxChars / 1000)}.000 caratteri). Dividilo in più parti.`;
}


// Inizio della giornata e del mese in Italia (il budget si rinnova a mezzanotte).
function romeBoundaries(now = new Date()) {
  const wall = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Rome" }) + " UTC");
  const offset = wall.getTime() - Math.floor(now.getTime() / 1000) * 1000;
  const day = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) - offset);
  const month = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), 1) - offset);
  return { day, month };
}

// Registra il costo di una chiamata all'AI già eseguita (token → euro).
// Non lancia mai errori: un contatore che non funziona non deve rompere Zefiro.
export async function recordAiCost(kind: AiKind, usage: AiUsageTokens | null | undefined) {
  if (!usage) return;
  try {
    const user = await getCachedUser();
    if (!user) return;
    const supabase = await createClient();
    const { error } = await supabase.from("ai_usage").insert({
      user_id: user.id,
      kind: `cost:${kind}`,
      input_tokens: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
      output_tokens: usage.output_tokens ?? 0,
      cost_eur: Number(costInEuro(usage).toFixed(5)),
    });
    if (error) console.error("[aiQuota] costo non registrato:", error.message);
  } catch (error) {
    console.error("[aiQuota] errore nel registrare il costo:", error);
  }
}

export type AiUsageSummary = {
  plan: AiPlanId;
  dailyBudgetEur: number;
  spentTodayEur: number;
  spentMonthEur: number;
  callsToday: number;
  callsMonth: number;
  byFeature: { kind: string; calls: number; costEur: number }[];
  available: boolean; // false se la migrazione 0035 non è stata eseguita
};

async function readPlan(userId: string): Promise<AiPlanId> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("ai_plan").eq("id", userId).maybeSingle();
  return parseAiPlan((data as { ai_plan?: string } | null)?.ai_plan);
}

// Consumi dell'utente: oggi e nel mese, con il dettaglio per funzione.
export async function getAiUsageSummary(): Promise<AiUsageSummary | null> {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();
  const plan = await readPlan(user.id);
  const { day, month } = romeBoundaries();

  const { data, error } = await supabase
    .from("ai_usage")
    .select("kind, cost_eur, created_at")
    .eq("user_id", user.id)
    .or("kind.like.cost:%,kind.eq.client:zefiro")
    .gte("created_at", month.toISOString())
    .limit(5000);

  const base = { plan, dailyBudgetEur: planById(plan).dailyBudgetEur };
  if (error) {
    return { ...base, spentTodayEur: 0, spentMonthEur: 0, callsToday: 0, callsMonth: 0, byFeature: [], available: false };
  }

  let spentToday = 0;
  let spentMonth = 0;
  let callsToday = 0;
  const perFeature = new Map<string, { calls: number; costEur: number }>();
  for (const row of data ?? []) {
    const cost = Number(row.cost_eur) || 0;
    spentMonth += cost;
    const isToday = new Date(row.created_at as string) >= day;
    if (isToday) {
      spentToday += cost;
      callsToday++;
    }
    const kind = String(row.kind).replace("cost:", "");
    const entry = perFeature.get(kind) ?? { calls: 0, costEur: 0 };
    entry.calls++;
    entry.costEur += cost;
    perFeature.set(kind, entry);
  }
  return {
    ...base,
    spentTodayEur: spentToday,
    spentMonthEur: spentMonth,
    callsToday,
    callsMonth: data?.length ?? 0,
    byFeature: [...perFeature.entries()].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => b.costEur - a.costEur),
    available: true,
  };
}

// Da chiamare subito prima di una chiamata all'AI. Richiede un utente
// autenticato, controlla i limiti e, se tutto è in regola, registra l'uso.
// Se la tabella dei contatori non esiste ancora (migrazione 0030 non
// eseguita) o il database non risponde, la funzione AI resta disponibile:
// meglio un servizio attivo che bloccato per un problema del contatore.
export async function reserveAiCall(kind: AiKind): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };

  try {
    const supabase = await createClient();
    const now = Date.now();
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const [hourly, daily] = await Promise.all([
      supabase
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("kind", "like", "cost:%")
        .not("kind", "like", "client:%")
        .gte("created_at", hourAgo),
      supabase
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("kind", "like", "cost:%")
        .not("kind", "like", "client:%")
        .gte("created_at", dayAgo),
    ]);

    if (hourly.error || daily.error) {
      console.error("[aiQuota] contatore non disponibile:", hourly.error?.message ?? daily.error?.message);
      return { ok: true };
    }

    if ((hourly.count ?? 0) >= MAX_CALLS_PER_HOUR) {
      return {
        ok: false,
        error: "Hai fatto molte richieste nell'ultima ora. Riprova tra un po', oppure continua a mano.",
      };
    }
    if ((daily.count ?? 0) >= MAX_CALLS_PER_DAY) {
      return {
        ok: false,
        error: "Hai raggiunto il limite giornaliero di richieste. Riprova domani, oppure continua a mano.",
      };
    }

    // Budget giornaliero del pacchetto (in euro, si azzera a mezzanotte)
    const summary = await getAiUsageSummary();
    if (summary?.available && summary.spentTodayEur >= summary.dailyBudgetEur) {
      return {
        ok: false,
        error: `Hai usato tutto il budget di Zefiro di oggi (${formatEuro(summary.dailyBudgetEur)}). Si rinnova a mezzanotte: nel frattempo puoi continuare a mano, oppure passare a un pacchetto più ampio nelle Impostazioni.`,
      };
    }

    const { error: insertError } = await supabase.from("ai_usage").insert({ user_id: user.id, kind });
    if (insertError) console.error("[aiQuota] registrazione non riuscita:", insertError.message);
    return { ok: true };
  } catch (error) {
    console.error("[aiQuota] errore inatteso:", error);
    return { ok: true };
  }
}
