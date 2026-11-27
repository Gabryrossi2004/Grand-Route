"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { companyIdOf } from "@/lib/team";

// L'archivio di Zefiro, lato agenzia: domande frequenti, risposte salvate e contatore.

export type FaqRow = { id: string; question: string; answer: string };
export type MemoryRow = { id: string; question: string; answer: string; countries: string[]; uses: number; edited: boolean; created_at: string };
export type ArchiveData = {
  ready: boolean; // la migrazione 0049 è stata eseguita
  faqs: FaqRow[];
  memory: MemoryRow[];
  month: { free: number; ai: number; bySource: Record<string, number> };
};

const PATH = "/dashboard/settings/zefiro";
const MISSING = /relation|does not exist|schema cache|function/i;

export async function loadArchive(): Promise<ArchiveData> {
  const user = await getCachedUser();
  const empty: ArchiveData = { ready: false, faqs: [], memory: [], month: { free: 0, ai: 0, bySource: {} } };
  if (!user) return empty;
  const companyId = await companyIdOf(user.id);
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [faqs, memory, usage] = await Promise.all([
    supabase.from("agency_faqs").select("id, question, answer").eq("owner_id", companyId).order("created_at"),
    supabase.from("zefiro_memory").select("id, question, answer, countries, uses, edited, created_at").eq("owner_id", companyId).order("uses", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("ai_usage").select("kind").eq("user_id", user.id).or("kind.like.free:%,kind.eq.client:zefiro").gte("created_at", monthStart.toISOString()).limit(20000),
  ]);
  if (faqs.error && MISSING.test(faqs.error.message)) return empty;
  const bySource: Record<string, number> = {};
  let free = 0;
  let ai = 0;
  for (const row of usage.data ?? []) {
    const kind = String(row.kind);
    if (kind.startsWith("free:")) {
      free++;
      const src = kind.slice(5);
      bySource[src] = (bySource[src] ?? 0) + 1;
    } else ai++;
  }
  return {
    ready: true,
    faqs: (faqs.data as FaqRow[]) ?? [],
    memory: (memory.data as MemoryRow[]) ?? [],
    month: { free, ai, bySource },
  };
}

type Result = { ok: true } | { ok: false; error: string };

function clean(text: unknown, max: number) {
  return String(text ?? "").trim().slice(0, max);
}

export async function saveFaq(input: { id?: string; question: string; answer: string }): Promise<Result> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  const question = clean(input.question, 300);
  const answer = clean(input.answer, 3000);
  if (question.length < 3 || !answer) return { ok: false, error: "Scrivi sia la domanda sia la risposta." };
  const supabase = await createClient();
  const { error } = input.id
    ? await supabase.from("agency_faqs").update({ question, answer, updated_at: new Date().toISOString() }).eq("id", input.id).eq("owner_id", companyId)
    : await supabase.from("agency_faqs").insert({ owner_id: companyId, question, answer });
  if (error) return { ok: false, error: MISSING.test(error.message) ? "Serve l'aggiornamento del database 0049." : "Salvataggio non riuscito, riprova." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteFaq(id: string): Promise<Result> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  const supabase = await createClient();
  const { error } = await supabase.from("agency_faqs").delete().eq("id", id).eq("owner_id", companyId);
  if (error) return { ok: false, error: "Eliminazione non riuscita, riprova." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateMemory(id: string, answer: string): Promise<Result> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  const text = clean(answer, 4000);
  if (!text) return { ok: false, error: "La risposta non può essere vuota." };
  const supabase = await createClient();
  const { error } = await supabase.from("zefiro_memory").update({ answer: text, edited: true }).eq("id", id).eq("owner_id", companyId);
  if (error) return { ok: false, error: "Salvataggio non riuscito, riprova." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteMemory(id: string): Promise<Result> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  const supabase = await createClient();
  const { error } = await supabase.from("zefiro_memory").delete().eq("id", id).eq("owner_id", companyId);
  if (error) return { ok: false, error: "Eliminazione non riuscita, riprova." };
  revalidatePath(PATH);
  return { ok: true };
}

// «Chiedi al Mappamondo»: domanda dell'agenzia, risposta dalle schede e dall'archivio, senza AI
export async function askMappamondo(question: string): Promise<{ answer?: string; source?: string; country?: string; error?: string }> {
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  const text = clean(question, 300);
  if (text.length < 3) return { error: "Scrivi una domanda, per esempio «Quando andare a Zanzibar?»." };
  const { answerAgencyQuestion } = await import("@/lib/mappamondoAnswer");
  const supabase = await createClient();
  const [faqs, memory] = await Promise.all([
    supabase.from("agency_faqs").select("question, answer").eq("owner_id", companyId).limit(200),
    supabase.from("zefiro_memory").select("question, answer").eq("owner_id", companyId).limit(500),
  ]);
  const found = answerAgencyQuestion(text, { faqs: faqs.data ?? [], memory: memory.data ?? [] });
  if (!found) {
    return {
      error:
        "Non ho trovato una risposta sicura nell'archivio. Prova a nominare il paese o la zona e l'argomento (periodo, documenti, moneta, fuso, prese, cucina, cosa vedere, cosa fare, itinerari, consigli), oppure apri la scheda del paese.",
    };
  }
  await supabase.from("ai_usage").insert({ user_id: user.id, kind: "free:mappamondo" });
  return found;
}
