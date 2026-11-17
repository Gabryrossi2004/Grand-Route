"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { costInEuro, parseAiPlan, planById, type PricedModel } from "@/lib/aiPricing";
import { buildClientSystemPrompt, buildClientTripDigest, toneInstructions } from "@/lib/clientTripDigest";
import { romeToday } from "@/lib/destinationInfo";
import type { Activity, Trip, TripDay, TripPayment } from "@/lib/types";

// Zefiro risponde alle domande dei clienti sul loro viaggio. Si usa il modello
// più economico (le domande sono semplici e molte); se per qualche motivo non
// risponde, si ripiega su quello più capace. Il costo va al budget dell'agenzia.
const PRIMARY: { id: string; priced: PricedModel } = { id: "claude-haiku-5-5", priced: "haiku" };
const FALLBACK: { id: string; priced: PricedModel } = { id: "claude-sonnet-5-5", priced: "sonnet" };

// I clienti possono usare al massimo questa parte del budget giornaliero
// dell'agenzia: il resto resta all'agenzia.
const CLIENT_SHARE_OF_BUDGET = 0.7;

const MAX_QUESTION = 500;
const MAX_HISTORY = 6;
const MAX_HISTORY_CHARS = 800;

const AnswerSchema = z.object({
  answer: z.string().describe("La risposta al cliente, breve e chiara."),
  needs_agency: z
    .boolean()
    .describe("True se l'informazione manca nei dati o serve l'agenzia (domande non coperte, emergenze, argomenti da non trattare)."),
});

export type ZefiroTurn = { role: "user" | "assistant"; content: string };
export type ZefiroReply =
  | { answer: string; needsAgency: boolean }
  | { error: string; suggestAgency?: boolean };

type Db = Awaited<ReturnType<typeof createClient>>;

async function getUsage(response: { usage: unknown }) {
  return response.usage as {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

async function callModel(
  model: { id: string; priced: PricedModel },
  system: string,
  messages: ZefiroTurn[],
) {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: model.id,
    max_tokens: 1500,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
    output_config: { effort: "low", format: zodOutputFormat(AnswerSchema) },
  });
  return { response, usage: await getUsage(response), priced: model.priced };
}

// Solo gli ultimi scambi, in ordine corretto (si parte sempre da una domanda del cliente)
function cleanHistory(history: ZefiroTurn[] | undefined): ZefiroTurn[] {
  const valid = (history ?? [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, content: t.content.trim().slice(0, MAX_HISTORY_CHARS) }));
  while (valid.length > 0 && valid[0].role !== "user") valid.shift();
  const alternating: ZefiroTurn[] = [];
  for (const turn of valid) {
    if (alternating.length > 0 && alternating[alternating.length - 1].role === turn.role) alternating.pop();
    alternating.push(turn);
  }
  // L'ultimo scambio deve essere una risposta, perché poi arriva la nuova domanda
  if (alternating.length > 0 && alternating[alternating.length - 1].role === "user") alternating.pop();
  return alternating;
}

export async function askZefiroAboutTrip(tripId: string, question: string, history?: ZefiroTurn[]): Promise<ZefiroReply> {
  const text = String(question ?? "").trim();
  if (!text) return { error: "Scrivi la tua domanda." };
  if (text.length > MAX_QUESTION) return { error: `La domanda è troppo lunga (massimo ${MAX_QUESTION} caratteri).` };

  const supabase: Db = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };

  // 1. Zefiro è acceso per questo viaggio? C'è ancora budget oggi?
  const { data: statusRows, error: statusError } = await supabase.rpc("client_zefiro_status", { p_trip_id: tripId });
  const status = (statusRows as { enabled: boolean; plan: string; spent_today: number }[] | null)?.[0];
  if (statusError || !status) {
    if (statusError) console.error("[askZefiro] stato", statusError.code, statusError.message);
    return { error: "Zefiro non è disponibile per questo viaggio.", suggestAgency: true };
  }
  if (!status.enabled) return { error: "Zefiro non è attivo per questo viaggio.", suggestAgency: true };

  const budget = planById(parseAiPlan(status.plan)).dailyBudgetEur;
  if (Number(status.spent_today) >= budget * CLIENT_SHARE_OF_BUDGET) {
    return { error: "Per oggi Zefiro ha finito le risposte. Scrivi all'agenzia: ti risponde appena possibile.", suggestAgency: true };
  }

  // 2. Prenota la domanda (qui il database applica i limiti per cliente)
  const { data: callId, error: reserveError } = await supabase.rpc("client_zefiro_reserve", { p_trip_id: tripId });
  if (reserveError || !callId) {
    if (/limite_zefiro/.test(reserveError?.message ?? "")) {
      return { error: "Hai fatto molte domande a Zefiro. Riprova tra un po', oppure scrivi all'agenzia.", suggestAgency: true };
    }
    console.error("[askZefiro] prenotazione", reserveError?.code, reserveError?.message);
    return { error: "Non è stato possibile contattare Zefiro. Riprova tra poco." };
  }

  try {
    // 3. I dati che il cliente può già vedere (le regole del database valgono anche qui)
    const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
    if (!trip) return { error: "Viaggio non trovato." };
    const [{ data: days }, { data: payments }, { data: owner }] = await Promise.all([
      supabase
        .from("trip_days")
        .select("*, activities(*)")
        .eq("trip_id", tripId)
        .order("day_order", { ascending: true }),
      supabase.from("trip_payments").select("*").eq("trip_id", tripId).eq("direction", "incasso"),
      supabase
        .from("profiles")
        .select("agency_name, emergency_phone, ai_preferences")
        .eq("id", (trip as Trip).owner_id)
        .maybeSingle(),
    ]);

    const orderedDays = ((days as (TripDay & { activities: Activity[] })[]) ?? []).map((day) => ({
      ...day,
      activities: day.activities ?? [],
    }));
    const today = romeToday();
    const digest = buildClientTripDigest({
      trip: trip as Trip,
      days: orderedDays,
      payments: (payments as TripPayment[]) ?? [],
      today,
    });
    const ownerRow = owner as { agency_name: string | null; emergency_phone: string | null; ai_preferences: Record<string, string> | null } | null;
    const system = buildClientSystemPrompt({
      agencyName: ownerRow?.agency_name || "di viaggi",
      agencyPhone: (trip as Trip).show_emergency_button ? (ownerRow?.emergency_phone ?? null) : null,
      today,
      digest,
      tone: toneInstructions(ownerRow?.ai_preferences),
    });

    const messages: ZefiroTurn[] = [...cleanHistory(history), { role: "user", content: text }];

    // 4. Risposta: prima il modello economico, poi, se serve, quello più capace
    let result;
    try {
      result = await callModel(PRIMARY, system, messages);
    } catch (error) {
      console.error("[askZefiro] modello principale:", (error as Error).message);
      result = await callModel(FALLBACK, system, messages);
    }

    // 5. Il costo vero, al budget dell'agenzia
    const euro = costInEuro(result.usage, result.priced);
    const { error: costError } = await supabase.rpc("client_zefiro_record_cost", {
      p_call_id: callId,
      p_input: (result.usage.input_tokens ?? 0) + (result.usage.cache_read_input_tokens ?? 0) + (result.usage.cache_creation_input_tokens ?? 0),
      p_output: result.usage.output_tokens ?? 0,
      p_cost: Number(euro.toFixed(5)),
    });
    if (costError) console.error("[askZefiro] costo non registrato:", costError.message);

    if (result.response.stop_reason === "refusal" || !result.response.parsed_output) {
      return { answer: "Su questo non posso aiutarti: scrivi all'agenzia, ti risponderà direttamente.", needsAgency: true };
    }
    return { answer: result.response.parsed_output.answer, needsAgency: result.response.parsed_output.needs_agency };
  } catch (error) {
    console.error("[askZefiro]", (error as Error).message);
    return { error: "Zefiro non riesce a rispondere in questo momento. Riprova tra poco, oppure scrivi all'agenzia.", suggestAgency: true };
  }
}
