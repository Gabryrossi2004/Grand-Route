import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { supplierCategoryOptions } from "@/lib/serviceStatus";
import type { SupplierCategory } from "@/lib/types";

const categoryValues = supplierCategoryOptions.map((option) => option.value) as [
  SupplierCategory,
  ...SupplierCategory[],
];

const PriceListItemSchema = z.object({
  category: z.enum(categoryValues).describe("Categoria più adatta per questo servizio."),
  title: z.string().describe("Nome del servizio/prodotto, come scritto nel listino (es. nome camera, tipo transfer)."),
  description: z.string().nullable().describe("Dettagli aggiuntivi utili (es. cosa include), o null se non ce ne sono."),
  price: z.number().nullable().describe("Prezzo come numero, senza simbolo di valuta. Null se non indicato."),
  unit: z.string().nullable().describe('Unità del prezzo come scritta nel listino (es. "a notte", "a persona", "a tratta"). Null se non chiara.'),
  valid_from: z.string().nullable().describe("Data di inizio validità in formato YYYY-MM-DD, se indicata. Altrimenti null."),
  valid_to: z.string().nullable().describe("Data di fine validità in formato YYYY-MM-DD, se indicata. Altrimenti null."),
  notes: z.string().nullable().describe("Condizioni o note importanti (es. cancellazione, minimo notti). Null se non presenti."),
});

export const PriceListExtractionSchema = z.object({
  items: z.array(PriceListItemSchema),
});

export type PriceListExtraction = z.infer<typeof PriceListExtractionSchema>;

const SYSTEM_PROMPT = `Sei un assistente che legge il listino prezzi di un fornitore turistico (hotel, trasporti, attività, ristorazione) e lo trasforma in un elenco strutturato di voci.

REGOLE FONDAMENTALI:
1. Non inventare MAI un dato non presente nel testo originale: prezzo, date di validità, condizioni. Se un'informazione non c'è, usa null.
2. Una riga per ogni servizio/tariffa distinta (es. se un hotel ha più tipi di camera con prezzi diversi, sono righe separate).
3. Il prezzo va estratto come numero puro, senza simboli di valuta o testo.
4. Scrivi sempre in italiano, tranne i nomi propri (nomi di hotel, camere, ecc.) che vanno lasciati come nel testo originale.
5. Ignora righe di intestazione, loghi, informazioni di contatto del fornitore: estrai solo le voci di listino vere e proprie.`;

// Trasforma il testo di un listino (da Excel o testo incollato) in un
// elenco di voci strutturate. L'agente rivede sempre il risultato prima di
// salvarlo: questa funzione propone, non scrive mai direttamente nel
// database.
export async function extractPriceListItems(draftText: string): Promise<PriceListExtraction> {
  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: draftText }],
    output_config: { effort: "medium", format: zodOutputFormat(PriceListExtractionSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("L'AI non è riuscita a interpretare il listino in un formato valido.");
  }

  return response.parsed_output;
}
