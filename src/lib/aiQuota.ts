import { createClient, getCachedUser } from "@/lib/supabase/server";

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

export type AiKind = "itinerary" | "client_request" | "price_list" | "review" | "rules_test";

export function tooLongMessage(maxChars: number) {
  return `Il testo è troppo lungo (massimo circa ${Math.round(maxChars / 1000)}.000 caratteri). Dividilo in più parti.`;
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
        .gte("created_at", hourAgo),
      supabase
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
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

    const { error: insertError } = await supabase.from("ai_usage").insert({ user_id: user.id, kind });
    if (insertError) console.error("[aiQuota] registrazione non riuscita:", insertError.message);
    return { ok: true };
  } catch (error) {
    console.error("[aiQuota] errore inatteso:", error);
    return { ok: true };
  }
}
