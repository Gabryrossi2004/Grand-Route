import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { activityTypes } from "@/lib/activityTypes";
import type { Activity, Trip, TripDay } from "@/lib/types";

// "Suggerimenti": l'AI rilegge un viaggio già creato (anche a mano) e propone
// correzioni e miglioramenti. Prima può fare qualche domanda per capire il
// contesto (chi viaggia, ritmo, budget...), poi restituisce i suggerimenti.
// Sono solo proposte da leggere: non modifica nulla del viaggio.

const MAX_DIGEST_CHARS = 40_000;

export type DayWithActivities = TripDay & { activities: Activity[] };

function stripHtml(html: string | null | undefined) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(date: string | null) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("it-IT");
}

// Riassume il viaggio in testo semplice, nell'ordine in cui lo vedrà il cliente.
export function buildTripDigest(trip: Trip, days: DayWithActivities[]): string {
  const lines: string[] = [];
  lines.push(`VIAGGIO: ${trip.title}`);
  if (trip.destination) lines.push(`Destinazione: ${trip.destination}`);
  const start = formatDate(trip.start_date);
  const end = formatDate(trip.end_date);
  if (start && end) lines.push(`Date: dal ${start} al ${end}`);
  else if (start) lines.push(`Data di partenza: ${start}`);
  lines.push(`Stato dell'itinerario: ${trip.itinerary_stage === "finale" ? "finale" : "preliminare"}`);
  if (trip.client_request_notes) lines.push(`Note sulla richiesta del cliente: ${trip.client_request_notes}`);
  lines.push("");

  const ordered = [...days].sort((a, b) => a.day_order - b.day_order);
  ordered.forEach((day, index) => {
    const date = formatDate(day.day_date);
    lines.push(`GIORNO ${index + 1}${date ? ` (${date})` : ""}${day.title ? ` — ${day.title}` : ""}`);
    const activities = [...(day.activities ?? [])].sort((a, b) => a.activity_order - b.activity_order);
    if (activities.length === 0) lines.push("  (nessuna attività)");
    for (const activity of activities) {
      const type = activityTypes[activity.activity_type]?.label ?? activity.activity_type;
      const parts = [`  - ${activity.start_time ? activity.start_time.slice(0, 5) : "orario non indicato"} [${type}] ${activity.title}`];
      if (activity.location) parts.push(`luogo: ${activity.location}`);
      const details = Object.entries(activity.details ?? {})
        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
        .map(([key, value]) => `${key}=${String(value)}`)
        .join("; ");
      if (details) parts.push(`dettagli: ${details}`);
      const description = stripHtml(activity.description);
      parts.push(description ? `descrizione: ${description.slice(0, 350)}` : "descrizione: assente");
      lines.push(parts.join(" | "));
    }
    lines.push("");
  });

  return lines.join("\n").slice(0, MAX_DIGEST_CHARS);
}

const QuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().describe("Domanda breve e concreta, a cui l'agente può rispondere in una riga."),
        why: z.string().nullable().describe("In poche parole, perché la risposta aiuta a dare consigli migliori."),
      }),
    )
    .max(5),
});

export type ReviewQuestions = z.infer<typeof QuestionsSchema>;

const CATEGORIES = ["errore", "logistica", "orari", "ritmo", "completezza", "esperienza", "stile"] as const;

const SuggestionsSchema = z.object({
  summary: z.string().describe("Valutazione complessiva in 2-3 frasi: cosa funziona e cosa migliorare di più."),
  suggestions: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        priority: z.enum(["alta", "media", "bassa"]),
        day_number: z.number().int().nullable().describe("Numero del giorno interessato (1 = primo giorno), o null se riguarda tutto il viaggio."),
        activity_title: z.string().nullable().describe("Titolo dell'attività interessata, se il suggerimento ne riguarda una in particolare."),
        title: z.string().describe("Il suggerimento in una frase breve."),
        detail: z.string().describe("Spiegazione in 1-3 frasi: cosa non torna o cosa si potrebbe migliorare, e come."),
      }),
    )
    .max(10),
});

export type ReviewSuggestions = z.infer<typeof SuggestionsSchema>;
export type ReviewCategory = (typeof CATEGORIES)[number];

const BASE_ROLE = `Sei un revisore esperto di itinerari di viaggio per agenzie e tour operator italiani. Ricevi la descrizione di un viaggio (giorno per giorno, con orari, tipi di attività, luoghi e descrizioni). Scrivi sempre in italiano, in modo chiaro e collaborativo, con un tono da collega esperto.`;

const QUESTIONS_SYSTEM = `${BASE_ROLE}

COMPITO: stabilire se per dare buoni consigli ti mancano informazioni di contesto decisive (per esempio: chi viaggia ed età, ritmo desiderato, budget, mobilità o esigenze particolari, interessi, stagione, esperienza di viaggio dei clienti).
- Formula da 0 a 5 domande brevi e concrete, a cui l'agente può rispondere in una riga.
- NON chiedere ciò che è già scritto nell'itinerario o nelle note sulla richiesta del cliente.
- Se hai già abbastanza contesto, restituisci un elenco vuoto.`;

const SUGGESTIONS_SYSTEM = `${BASE_ROLE}

COMPITO: rileggi l'itinerario e proponi correzioni e miglioramenti, dal più importante al meno importante (massimo 10).

COSA CERCARE:
- errori e incoerenze (date, giorni vuoti, orari sovrapposti o impossibili, volo di arrivo senza alloggio o transfer, check-in/check-out mancanti, pernottamento che manca per una notte);
- logistica (tempi di spostamento troppo stretti o irrealistici, ordine illogico delle tappe, attività lontane messe in sequenza);
- ritmo (giorni troppo pieni o troppo vuoti, troppi spostamenti, mancanza di pause);
- completezza (descrizioni mancanti, informazioni utili assenti: punto d'incontro, durata, cosa portare);
- esperienza (idee per migliorare il viaggio, in linea col tipo di clienti);
- stile (descrizioni poco curate o incoerenti nel tono).

REGOLE:
1. Non inventare fatti: orari di apertura, prezzi, nomi di fornitori. Se proponi qualcosa di nuovo, presentalo chiaramente come una proposta da verificare.
2. Ogni suggerimento deve essere concreto e indicare il giorno e, se serve, l'attività interessata.
3. Dai priorità "alta" solo a errori o problemi che rovinerebbero il viaggio; "bassa" ai miglioramenti facoltativi.
4. Se qualcosa funziona molto bene non serve un suggerimento: puoi dirlo nella valutazione complessiva.
5. Tieni conto delle risposte dell'agente alle domande di contesto, se presenti.
6. Se l'itinerario è già molto buono restituisci pochi suggerimenti: non riempire la lista.`;

export async function generateReviewQuestions(digest: string): Promise<ReviewQuestions> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 2000,
    system: QUESTIONS_SYSTEM,
    messages: [{ role: "user", content: digest }],
    output_config: { effort: "low", format: zodOutputFormat(QuestionsSchema) },
  });
  if (!response.parsed_output) throw new Error("Domande non valide.");
  return response.parsed_output;
}

export async function generateReviewSuggestions(
  digest: string,
  answers: { question: string; answer: string }[],
): Promise<ReviewSuggestions> {
  const client = new Anthropic();
  const answered = answers.filter((item) => item.answer.trim().length > 0);
  const context = answered.length
    ? `\n\nCONTESTO FORNITO DALL'AGENTE (risposte alle domande):\n${answered
        .map((item) => `- ${item.question}\n  Risposta: ${item.answer.trim().slice(0, 600)}`)
        .join("\n")}`
    : "";

  const response = await client.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 6000,
    system: SUGGESTIONS_SYSTEM,
    messages: [{ role: "user", content: `${digest}${context}` }],
    output_config: { effort: "medium", format: zodOutputFormat(SuggestionsSchema) },
  });
  if (!response.parsed_output) throw new Error("Suggerimenti non validi.");
  return response.parsed_output;
}
