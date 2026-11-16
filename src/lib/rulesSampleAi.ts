import Anthropic from "@anthropic-ai/sdk";

// Genera un breve esempio che applica le regole (di base + dell'agenzia), per
// far vedere all'agenzia l'effetto delle proprie regole prima di salvarle.
export async function generateRulesSample(rulesBlock: string): Promise<string> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 700,
    system: `Sei l'assistente di un'agenzia di viaggi: scrivi i testi degli itinerari per i clienti. Rispondi SOLO con il testo richiesto, senza commenti.\n\n${rulesBlock}`,
    messages: [
      {
        role: "user",
        content:
          "Scrivi la voce di itinerario per questa attività, nell'ordine: riga con orario e titolo, poi la descrizione per il cliente.\nAttività: Visita guidata al Colosseo, alle 9:30 AM, punto di incontro davanti all'ingresso principale, durata circa 2 ore.",
      },
    ],
    output_config: { effort: "low" },
  });
  return response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}
