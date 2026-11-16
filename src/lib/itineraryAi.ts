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

function buildSystemPrompt(styleExamples: string[], styleInstructions: string | null, tripDays: number | null = null): string {
  const stylePart =
    styleExamples.length > 0
      ? `\n\nSTILE DI SCRITTURA DI QUESTA AGENZIA (esempi reali da loro itinerari precedenti — scrivi le nuove descrizioni con un tono e uno stile simile a questi):\n${styleExamples
          .map((example, index) => `${index + 1}. ${example}`)
          .join("\n")}`
      : "";

  const chosenStylePart = styleInstructions
    ? `\n\nSTILE RICHIESTO PER QUESTO VIAGGIO (scelto dall'agenzia per questo cliente/tipo di viaggio specifico — ha priorità sul tono generico della regola 6):\n${styleInstructions}`
    : "";

  const durationPart = tripDays
    ? `\n7. DURATA: il viaggio dura esattamente ${tripDays} giorni (day_index da 0 a ${tripDays - 1}). Distribuisci la bozza su questi giorni. Se la bozza descrive meno giorni, i giorni finali restano senza attività (elenco "activities" vuoto); se ne descrive di più, includili comunque tutti, senza scartare nulla.`
    : "";

  return `Sei un assistente che trasforma la bozza di un itinerario di viaggio (scritta liberamente da un'agenzia o tour operator) in un itinerario strutturato, giorno per giorno, usando le categorie di attività del loro gestionale.

TIPI DI ATTIVITÀ DISPONIBILI (scegli sempre il più adatto, non inventarne altri):
${describeActivityTypes()}

REGOLE FONDAMENTALI:
1. Non inventare MAI un dato che non è presente nella bozza originale: orari, numeri di telefono, punti di incontro, numeri di conferma, nomi di fornitori, ecc. Se un'informazione non c'è, lascia il campo null (o non inserire quella chiave in "details") e limitati a descrivere a parole quello che si sa.
2. Scrivi sempre in italiano.
3. Dividi le attività nei giorni corretti, in ordine cronologico, a partire da day_index 0.
4. Ogni attività ha un titolo breve e chiaro.
5. Non aggiungere attività non presenti nella bozza, anche se "scontate" per quel tipo di viaggio.
6. Scrivi le descrizioni con un tono invitante e curato, come farebbe un'agenzia di viaggi per presentare l'esperienza al proprio cliente finale: non un elenco asettico di fatti logistici, ma 2-4 frasi scorrevoli e piacevoli da leggere. Questo riguarda SOLO lo stile della frase, mai il contenuto: continua a non aggiungere nessun dettaglio, luogo o dato che non sia già nella bozza (vedi regola 1).${durationPart}${chosenStylePart}${stylePart}`;
}

export type DraftImage = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

// Bozza come testo libero (incollato o estratto da un Excel/CSV), e/o una
// foto della bozza: quando c'è un'immagine, Claude la legge direttamente
// (anche testo scritto a mano, con risultati migliori su documenti
// stampati/leggibili). Il testo, se presente, è trattato come contesto
// aggiuntivo insieme alla foto, non alternativo.
export async function generateItineraryFromDraft(params: {
  draftText: string;
  styleExamples: string[];
  styleInstructions?: string | null;
  image?: DraftImage | null;
  // Durata del viaggio in giorni, se le date sono già note.
  tripDays?: number | null;
}): Promise<GeneratedItinerary> {
  const client = new Anthropic();

  const userContent: Anthropic.MessageParam["content"] = params.image
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: params.image.mediaType, data: params.image.base64 },
        },
        {
          type: "text",
          text:
            params.draftText ||
            "Analizza questa foto della bozza di itinerario e trasformala secondo le istruzioni.",
        },
      ]
    : params.draftText;

  const response = await client.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    system: buildSystemPrompt(params.styleExamples, params.styleInstructions ?? null, params.tripDays ?? null),
    messages: [{ role: "user", content: userContent }],
    // "medium" invece del default "high": questo compito (estrarre e
    // strutturare, non ragionare su un problema complesso) non sembra avere
    // bisogno del ragionamento più approfondito, e un effort più basso
    // genera meno token quindi risponde più in fretta (e costa un po' meno).
    // Da tenere d'occhio sulla qualità del risultato nell'uso reale.
    output_config: { effort: "medium", format: zodOutputFormat(GeneratedItinerarySchema) },
  });

  if (!response.parsed_output) {
    throw new Error("L'AI non è riuscita a interpretare la bozza in un formato valido.");
  }

  return response.parsed_output;
}
