import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { activityTypeOptions, detailFields } from "@/lib/activityTypes";
import type { ActivityType } from "@/lib/types";

const activityTypeValues = activityTypeOptions.map((option) => option.value) as [ActivityType, ...ActivityType[]];

const GeneratedActivitySchema = z.object({
  activity_type: z.enum(activityTypeValues),
  title: z.string().describe("Titolo breve e chiaro dell'attività."),
  start_time: z
    .string()
    .nullable()
    .describe("Orario in formato HH:MM se indicato nella bozza, altrimenti null. Non inventare un orario."),
  description: z
    .string()
    .nullable()
    .describe(
      "Breve descrizione in italiano di quello che si sa su questa attività. Null se non c'è nulla da scrivere oltre al titolo.",
    ),
  location: z.string().nullable().describe("Luogo/indirizzo se indicato nella bozza, altrimenti null."),
  details: z
    .record(z.string(), z.string())
    .describe(
      "Solo le chiavi elencate per questo tipo di attività nelle istruzioni, e solo quando il valore è presente nella bozza originale. Non inventare mai un valore.",
    ),
});

const GeneratedDaySchema = z.object({
  day_index: z.number().int().min(0).describe("Indice del giorno a partire da 0, in ordine cronologico."),
  title: z.string().nullable().describe('Titolo breve del giorno (es. "Arrivo a Roma"), o null se non necessario.'),
  activities: z.array(GeneratedActivitySchema),
});

export const GeneratedItinerarySchema = z.object({
  days: z.array(GeneratedDaySchema),
});

export type GeneratedItinerary = z.infer<typeof GeneratedItinerarySchema>;

// Descrizione dei tipi di attività e dei loro campi dettaglio, generata
// direttamente dalla configurazione reale (src/lib/activityTypes.ts) invece
// che scritta a mano: così il prompt non va mai fuori sincrono con lo schema
// effettivo del gestionale.
function describeActivityTypes(): string {
  return (Object.entries(detailFields) as [ActivityType, (typeof detailFields)[ActivityType]][])
    .map(([type, fields]) => {
      if (fields.length === 0) return `- ${type}: nessun campo dettaglio.`;
      const fieldList = fields
        .map((field) => (field.options ? `${field.key} (uno tra: ${field.options.join(", ")})` : field.key))
        .join(", ");
      return `- ${type}: campi dettaglio possibili (chiave esatta da usare in "details"): ${fieldList}.`;
    })
    .join("\n");
}

function buildSystemPrompt(styleExamples: string[]): string {
  const stylePart =
    styleExamples.length > 0
      ? `\n\nSTILE DI SCRITTURA DI QUESTA AGENZIA (esempi reali da loro itinerari precedenti — scrivi le nuove descrizioni con un tono e uno stile simile a questi):\n${styleExamples
          .map((example, index) => `${index + 1}. ${example}`)
          .join("\n")}`
      : "";

  return `Sei un assistente che trasforma la bozza di un itinerario di viaggio (scritta liberamente da un'agenzia o tour operator) in un itinerario strutturato, giorno per giorno, usando le categorie di attività del loro gestionale.

TIPI DI ATTIVITÀ DISPONIBILI (scegli sempre il più adatto, non inventarne altri):
${describeActivityTypes()}

REGOLE FONDAMENTALI:
1. Non inventare MAI un dato che non è presente nella bozza originale: orari, numeri di telefono, punti di incontro, numeri di conferma, nomi di fornitori, ecc. Se un'informazione non c'è, lascia il campo null (o non inserire quella chiave in "details") e limitati a descrivere a parole quello che si sa.
2. Scrivi sempre in italiano.
3. Dividi le attività nei giorni corretti, in ordine cronologico, a partire da day_index 0.
4. Ogni attività ha un titolo breve e chiaro.
5. Non aggiungere attività non presenti nella bozza, anche se "scontate" per quel tipo di viaggio.${stylePart}`;
}

// Fase 1: bozza come testo libero (incollato). Le fasi successive
// (Excel, foto) riusano questa stessa funzione, cambia solo come viene
// preparato il contenuto passato come messaggio utente.
export async function generateItineraryFromDraft(params: {
  draftText: string;
  styleExamples: string[];
}): Promise<GeneratedItinerary> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    system: buildSystemPrompt(params.styleExamples),
    messages: [{ role: "user", content: params.draftText }],
    output_config: { format: zodOutputFormat(GeneratedItinerarySchema) },
  });

  if (!response.parsed_output) {
    throw new Error("L'AI non è riuscita a interpretare la bozza in un formato valido.");
  }

  return response.parsed_output;
}
