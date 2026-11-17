import { recordAiCost } from "@/lib/aiQuota";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { DraftImage } from "@/lib/itineraryAi";

export const ClientRequestSchema = z.object({
  suggested_title: z
    .string()
    .describe('Titolo breve per il viaggio, in italiano (es. "Viaggio in Giappone per 2 persone").'),
  destination: z.string().nullable().describe("Destinazione principale, se indicata nella mail. Altrimenti null."),
  start_date: z
    .string()
    .nullable()
    .describe("Data di partenza in formato YYYY-MM-DD, SOLO se una data precisa è indicata nella mail. Altrimenti null: non dedurre o stimare una data."),
  end_date: z
    .string()
    .nullable()
    .describe("Data di ritorno in formato YYYY-MM-DD, con la stessa regola di start_date."),
  client_name: z.string().nullable().describe("Nome e cognome del cliente, se si capisce da firma o testo. Altrimenti null."),
  notes: z
    .string()
    .describe(
      "Riassunto in italiano, in 2-5 frasi scorrevoli, di tutto il resto della richiesta utile a preparare il viaggio: numero di persone, preferenze, budget indicato, occasioni speciali, richieste particolari. Stringa vuota se la mail non contiene altro oltre a destinazione/date.",
    ),
});

export type ClientRequest = z.infer<typeof ClientRequestSchema>;

const SYSTEM_PROMPT = `Sei un assistente che legge la mail di richiesta di un cliente a un'agenzia di viaggi o tour operator, ed estrae le informazioni utili a iniziare a preparare il viaggio.

REGOLE FONDAMENTALI:
1. Non inventare MAI un dato non presente nel testo: date, destinazione, numero di persone, budget. Se un'informazione non c'è, usa null (o non la citare nel riassunto).
2. Le date vanno estratte solo se precise (es. "dal 10 al 17 marzo 2026"); indicazioni vaghe (es. "a marzo", "in estate") vanno descritte a parole nel riassunto, non trasformate in una data inventata.
3. Scrivi sempre in italiano.
4. Il riassunto (notes) deve essere utile e leggibile da un'agente che poi dovrà costruire l'itinerario: non un elenco grezzo di parole chiave, ma frasi chiare.`;

// Estrae i dati utili da una mail di richiesta cliente (testo e/o foto).
// Non crea né modifica nulla: l'agente rivede sempre il risultato prima di
// usarlo per compilare il nuovo viaggio.
export async function extractClientRequest(params: {
  text: string;
  image?: DraftImage | null;
}): Promise<ClientRequest> {
  const client = new Anthropic();

  const userContent: Anthropic.MessageParam["content"] = params.image
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: params.image.mediaType, data: params.image.base64 },
        },
        {
          type: "text",
          text: params.text || "Analizza questa mail/screenshot di richiesta cliente secondo le istruzioni.",
        },
      ]
    : params.text;

  const response = await client.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    output_config: { effort: "medium", format: zodOutputFormat(ClientRequestSchema) },
  });

  await recordAiCost("client_request", response.usage);
  if (!response.parsed_output) {
    throw new Error("L'AI non è riuscita a interpretare la richiesta in un formato valido.");
  }

  return response.parsed_output;
}
