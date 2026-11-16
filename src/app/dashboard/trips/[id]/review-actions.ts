"use server";

import { createClient } from "@/lib/supabase/server";
import { reserveAiCall } from "@/lib/aiQuota";
import { loadAiRules } from "@/lib/aiRulesServer";
import {
  buildTripDigest,
  generateReviewQuestions,
  generateReviewSuggestions,
  type DayWithActivities,
  type ReviewQuestions,
  type ReviewSuggestions,
} from "@/lib/tripReviewAi";
import type { Trip } from "@/lib/types";

const MAX_ANSWERS = 5;

// Legge il viaggio dell'utente (le regole di sicurezza del database
// garantiscono che sia suo) e lo riassume in testo per l'AI.
async function loadDigest(tripId: string): Promise<{ digest: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };

  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).eq("owner_id", user.id).maybeSingle();
  if (!trip) return { error: "Viaggio non trovato." };

  const { data: days } = await supabase
    .from("trip_days")
    .select("*, activities(*)")
    .eq("trip_id", tripId)
    .order("day_order", { ascending: true });

  const typedDays = (days as DayWithActivities[] | null) ?? [];
  const activityCount = typedDays.reduce((sum, day) => sum + (day.activities?.length ?? 0), 0);
  if (activityCount === 0) {
    return { error: "Aggiungi prima qualche attività al viaggio: l'AI ha bisogno di un itinerario da rileggere." };
  }

  return { digest: buildTripDigest(trip as Trip, typedDays) };
}

// Passo 1: l'AI rilegge il viaggio e, se serve, chiede un po' di contesto.
export async function getReviewQuestions(tripId: string): Promise<{ questions: ReviewQuestions["questions"] } | { error: string }> {
  const loaded = await loadDigest(tripId);
  if ("error" in loaded) return loaded;

  const quota = await reserveAiCall("review");
  if (!quota.ok) return { error: quota.error };

  try {
    const rules = await loadAiRules();
    const result = await generateReviewQuestions(loaded.digest, rules.text);
    return { questions: result.questions };
  } catch (error) {
    console.error("[getReviewQuestions]", error);
    return { error: "L'AI non è riuscita a leggere il viaggio. Riprova tra poco." };
  }
}

// Passo 2: i suggerimenti, tenendo conto delle risposte (se ce ne sono).
export async function getReviewSuggestions(
  tripId: string,
  answers: { question: string; answer: string }[],
): Promise<{ result: ReviewSuggestions } | { error: string }> {
  const loaded = await loadDigest(tripId);
  if ("error" in loaded) return loaded;

  const cleanAnswers = (Array.isArray(answers) ? answers : [])
    .slice(0, MAX_ANSWERS)
    .map((item) => ({
      question: String(item?.question ?? "").slice(0, 300),
      answer: String(item?.answer ?? "").slice(0, 600),
    }));

  const quota = await reserveAiCall("review");
  if (!quota.ok) return { error: quota.error };

  try {
    const rules = await loadAiRules();
    const result = await generateReviewSuggestions(loaded.digest, cleanAnswers, rules.text);
    return { result };
  } catch (error) {
    console.error("[getReviewSuggestions]", error);
    return { error: "L'AI non è riuscita a preparare i suggerimenti. Riprova tra poco." };
  }
}
