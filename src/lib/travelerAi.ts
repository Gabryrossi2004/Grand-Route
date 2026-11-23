import { createClient, getCachedUser, getIsTraveler } from "@/lib/supabase/server";
import { romeBoundaries } from "@/lib/aiQuota";

// Zefiro per i viaggiatori privati: ogni mese un numero limitato di itinerari con l'AI (modello
// economico), con in più un tetto di spesa per utente. Le proposte della libreria restano gratis.
// Per cambiare i limiti basta modificare questi due numeri.
export const TRAVELER_AI = { itinerariesPerMonth: 5, maxCostEurPerMonth: 0.15 };

export type TravelerAllowance = {
  traveler: boolean;
  total: number;
  used: number;
  left: number; // itinerari ancora disponibili questo mese (0 anche se è finito il tetto di spesa)
  spentEur: number;
  limitEur: number;
  available: boolean; // false se i contatori non rispondono: in quel caso non si blocca nulla
};

export async function getTravelerAllowance(): Promise<TravelerAllowance> {
  const total = TRAVELER_AI.itinerariesPerMonth;
  const base = { total, limitEur: TRAVELER_AI.maxCostEurPerMonth };
  const user = await getCachedUser();
  if (!user || !(await getIsTraveler())) return { ...base, traveler: false, used: 0, left: total, spentEur: 0, available: true };
  try {
    const supabase = await createClient();
    const { month } = romeBoundaries();
    const { data, error } = await supabase
      .from("ai_usage")
      .select("kind, cost_eur")
      .eq("user_id", user.id)
      .or("kind.eq.traveler:itinerary,kind.like.cost:%")
      .gte("created_at", month.toISOString())
      .limit(2000);
    if (error) return { ...base, traveler: true, used: 0, left: total, spentEur: 0, available: false };
    let used = 0;
    let spent = 0;
    for (const row of data ?? []) {
      if (row.kind === "traveler:itinerary") used++;
      else spent += Number(row.cost_eur) || 0;
    }
    const overBudget = spent >= TRAVELER_AI.maxCostEurPerMonth;
    return { ...base, traveler: true, used, left: overBudget ? 0 : Math.max(0, total - used), spentEur: spent, available: true };
  } catch {
    return { ...base, traveler: true, used: 0, left: total, spentEur: 0, available: false };
  }
}

// Conta gli itinerari che stanno per essere scritti (da chiamare dopo aver deciso quanti sono)
export async function recordTravelerItineraries(count: number) {
  if (count <= 0) return;
  try {
    const user = await getCachedUser();
    if (!user) return;
    const supabase = await createClient();
    const rows = Array.from({ length: count }, () => ({ user_id: user.id, kind: "traveler:itinerary" }));
    const { error } = await supabase.from("ai_usage").insert(rows);
    if (error) console.error("[travelerAi] conteggio non registrato:", error.message);
  } catch (error) {
    console.error("[travelerAi] errore nel registrare il conteggio:", error);
  }
}

export const travelerLimitMessage = (a: TravelerAllowance) =>
  a.spentEur >= a.limitEur
    ? "Hai usato tutto il budget di Zefiro di questo mese. Si rinnova il primo del mese: nel frattempo puoi usare le proposte pronte, gratis."
    : `Hai usato i ${a.total} itinerari di Zefiro di questo mese. Si rinnovano il primo del mese: nel frattempo puoi usare le proposte pronte, gratis. Con un'agenzia i limiti non ci sono.`;
