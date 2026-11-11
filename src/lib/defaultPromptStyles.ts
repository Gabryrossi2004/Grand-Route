// Stili di partenza suggeriti nella scheda "Stili" della Libreria: ogni
// agenzia parte con questi (modificabili o cancellabili) e può aggiungerne
// di propri. Il contenuto guida solo il TONO delle descrizioni generate
// dall'AI, mai i dati: questo va sempre specificato nel testo stesso, per
// restare coerente con la regola di non inventare informazioni.
export const defaultPromptStyles: { title: string; prompt_text: string }[] = [
  {
    title: "Famiglia con bambini",
    prompt_text:
      "Il viaggio è pensato per una famiglia con bambini: nelle descrizioni valorizza comfort, sicurezza e il lato divertente/curioso delle attività per i più piccoli. Usa un linguaggio semplice, caldo e rassicurante.",
  },
  {
    title: "Luna di miele / romantico",
    prompt_text:
      "Il viaggio è una luna di miele o un'occasione romantica: scrivi le descrizioni con un tono intimo ed emozionante, mettendo in risalto l'atmosfera e i momenti speciali da vivere in coppia.",
  },
  {
    title: "Avventura / backpacker",
    prompt_text:
      "Il viaggio è pensato per chi cerca avventura e autenticità: usa un tono dinamico ed esplorativo, valorizzando la scoperta, la libertà e il lato più genuino delle esperienze.",
  },
  {
    title: "Lusso / esperienza esclusiva",
    prompt_text:
      "Il viaggio è di fascia alta: usa un tono elegante e raffinato, valorizzando l'esclusività, la cura dei dettagli e la qualità dell'esperienza, senza esagerare in toni pubblicitari.",
  },
  {
    title: "Gruppo over-60 / ritmi comodi",
    prompt_text:
      "Il gruppo è composto da persone con ritmi comodi: nelle descrizioni trasmetti tranquillità, comodità e piacevolezza, evitando un tono frenetico anche quando il programma è ricco.",
  },
  {
    title: "Business / essenziale e pratico",
    prompt_text:
      "Il viaggio ha finalità lavorative: scrivi descrizioni brevi, dirette e pratiche, concentrate sulle informazioni utili, con un tono professionale e senza fronzoli.",
  },
  {
    title: "Culturale / approfondimento",
    prompt_text:
      "Il viaggio ha un taglio culturale: nelle descrizioni valorizza il contesto storico, artistico o culturale di quello che si sa già, con un tono curato e un po' narrativo, senza inventare fatti non presenti nella bozza.",
  },
  {
    title: "Mare e relax",
    prompt_text:
      "Il viaggio è all'insegna del relax: usa un tono disteso e piacevole, evocando calma, comfort e il piacere di prendersela comoda.",
  },
  {
    title: "Instagrammabile / fotografico",
    prompt_text:
      "Il viaggio è pensato per chi ama la fotografia e i social: nelle descrizioni valorizza gli scorci più suggestivi e i momenti più fotogenici di quello che si sa già, con un tono vivace e visivo.",
  },
  {
    title: "Last-minute / economico",
    prompt_text:
      "Il viaggio è una soluzione economica organizzata in tempi stretti: scrivi descrizioni semplici e dirette, che valorizzino comunque l'esperienza senza sembrare un elenco spoglio.",
  },
];
