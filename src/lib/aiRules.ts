// Regole che guidano l'AI. Due livelli, uniti nelle istruzioni di ogni
// funzione AI (generazione itinerari, suggerimenti):
//  1. Regole di BASE della piattaforma: valgono per tutti. Quelle qui sotto
//     sono le predefinite; l'amministratore le può modificare, disattivare o
//     integrare dalla pagina "Regole di base dell'AI" (salvate nel database).
//  2. Regole dell'AGENZIA: tono, lunghezza, stile e regole scritte a mano da
//     ogni agenzia, valide solo per lei.
// Questo file non dipende dal database: così funziona anche se questo non
// risponde (si usano le regole predefinite).

export type PlatformRule = { key: string; title: string; body: string; enabled?: boolean; sort_order?: number };

export const DEFAULT_PLATFORM_RULES: Required<PlatformRule>[] = [
  {
    key: "no_invent",
    title: "Non inventare dati",
    body: "Non inventare MAI un dato che non è presente nella bozza originale: orari, numeri di telefono, punti di incontro, numeri di conferma, nomi di fornitori, prezzi. Se un'informazione non c'è, lascia il campo vuoto e limitati a descrivere a parole quello che si sa.",
    enabled: true,
    sort_order: 10,
  },
  {
    key: "language",
    title: "Lingua",
    body: "Scrivi sempre in italiano.",
    enabled: true,
    sort_order: 20,
  },
  {
    key: "no_extra_activities",
    title: "Nessuna attività aggiunta",
    body: "Non aggiungere attività che non sono nella bozza, anche se sembrano scontate per quel tipo di viaggio.",
    enabled: true,
    sort_order: 30,
  },
  {
    key: "tone",
    title: "Tono delle descrizioni",
    body: "Scrivi le descrizioni con un tono invitante e curato, come farebbe un'agenzia di viaggi che presenta l'esperienza al proprio cliente: di norma 2-4 frasi scorrevoli, non un elenco asettico di fatti logistici. Questo riguarda solo lo stile della frase, mai il contenuto: continua a non aggiungere dettagli, luoghi o dati che non sono nella bozza.",
    enabled: true,
    sort_order: 40,
  },
  {
    key: "time_formats",
    title: "Formato degli orari",
    body: "Gli orari possono essere scritti in qualunque formato: a 24 ore (13:30) oppure a 12 ore con AM/PM (1:30 PM, 1.30pm). Interpretali tutti correttamente (1:30 PM = 13:30; 12:00 AM = 00:00; 12:00 PM = 12:00) e scrivi sempre l'orario nel campo apposito in formato HH:MM a 24 ore.",
    enabled: true,
    sort_order: 50,
  },
  {
    key: "feasibility",
    title: "Verifica di distanze e tempi",
    body: "Verifica che l'itinerario sia fattibile: valuta con attenzione distanze e tempi di percorrenza realistici tra le tappe e nei trasferimenti (mezzo di trasporto, traffico, attese, check-in e check-out, orari di partenza e di arrivo). Se un tragitto è troppo lungo o i tempi sono troppo stretti, non cambiare di tua iniziativa la bozza: segnalalo all'agente nelle note, con la tua stima. Le stime sono approssimative: dichiara sempre che vanno verificate.",
    enabled: true,
    sort_order: 60,
  },
  {
    key: "ask_when_in_doubt",
    title: "Chiedere in caso di dubbio",
    body: "Se hai un dubbio che cambia in modo importante il risultato (informazioni ambigue, contraddittorie o mancanti che non puoi dedurre dalla bozza), non tirare a indovinare: fai una domanda breve e concreta all'agente. Per i dubbi di poco conto procedi con l'ipotesi più ragionevole e indicala nelle note.",
    enabled: true,
    sort_order: 70,
  },
];

// Unisce le regole salvate dall'amministratore con quelle predefinite:
// per ogni chiave vale la versione salvata (se c'è), le regole nuove aggiunte
// dall'amministratore si aggiungono in coda secondo il loro ordine.
export function mergePlatformRules(saved: PlatformRule[] | null | undefined): Required<PlatformRule>[] {
  const byKey = new Map<string, Required<PlatformRule>>(DEFAULT_PLATFORM_RULES.map((rule) => [rule.key, { ...rule }]));
  for (const row of saved ?? []) {
    if (!row?.key) continue;
    const base = byKey.get(row.key);
    byKey.set(row.key, {
      key: row.key,
      title: row.title ?? base?.title ?? row.key,
      body: row.body ?? base?.body ?? "",
      enabled: row.enabled ?? true,
      sort_order: row.sort_order ?? base?.sort_order ?? 1000,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key));
}

// ── Preferenze rapide dell'agenzia ──────────────────────────────────────

export const PREFERENCE_OPTIONS = {
  tone: {
    label: "Tono",
    choices: [
      { value: "", label: "Non specificato", sentence: "" },
      { value: "lei", label: "Dare del Lei", sentence: "Rivolgiti al cliente dandogli del Lei." },
      { value: "tu", label: "Dare del tu", sentence: "Rivolgiti al cliente dandogli del tu." },
    ],
  },
  length: {
    label: "Lunghezza delle descrizioni",
    choices: [
      { value: "", label: "Non specificata", sentence: "" },
      { value: "brevi", label: "Brevi (1-2 frasi)", sentence: "Scrivi descrizioni brevi: una o due frasi." },
      { value: "medie", label: "Medie (2-3 frasi)", sentence: "Scrivi descrizioni di media lunghezza: due o tre frasi." },
      {
        value: "ricche",
        label: "Ricche (3-5 frasi)",
        sentence: "Scrivi descrizioni ricche: tre-cinque frasi, usando però solo i dettagli presenti nella bozza.",
      },
    ],
  },
  style: {
    label: "Stile",
    choices: [
      { value: "", label: "Non specificato", sentence: "" },
      { value: "sobrio", label: "Sobrio ed elegante", sentence: "Usa uno stile sobrio ed elegante." },
      { value: "caldo", label: "Caldo e narrativo", sentence: "Usa uno stile caldo e narrativo, che racconta l'esperienza." },
      { value: "pratico", label: "Molto pratico", sentence: "Usa uno stile molto pratico e concreto, orientato alle informazioni utili." },
    ],
  },
  emoji: {
    label: "Emoji",
    choices: [
      { value: "", label: "Non specificato", sentence: "" },
      { value: "mai", label: "Mai", sentence: "Non usare mai emoji." },
      { value: "poche", label: "Con parsimonia", sentence: "Puoi usare qualche emoji, con parsimonia." },
    ],
  },
} as const;

export type PreferenceKey = keyof typeof PREFERENCE_OPTIONS;

export const MAX_AGENCY_RULES_CHARS = 2000;

// Esempi di regole da aggiungere con un clic, nelle Impostazioni.
export const RULE_EXAMPLES = [
  "Non usare mai le parole «imperdibile», «magico» o «da sogno».",
  "Alla fine di ogni giorno ricorda il punto di incontro del giorno dopo.",
  "Per i gruppi con persone over 65 evita più di due visite al giorno.",
  "Indica sempre se un'attività è adatta ai bambini.",
  "Nelle descrizioni cita sempre il nome della guida locale, se è nella bozza.",
];

export function buildAgencyRulesBlock(
  preferences: Record<string, string> | null | undefined,
  freeText: string | null | undefined,
): string {
  const lines: string[] = [];
  for (const key of Object.keys(PREFERENCE_OPTIONS) as PreferenceKey[]) {
    const chosen = preferences?.[key];
    const sentence = PREFERENCE_OPTIONS[key].choices.find((choice) => choice.value === chosen)?.sentence;
    if (sentence) lines.push(sentence);
  }
  const text = String(freeText ?? "").trim().slice(0, MAX_AGENCY_RULES_CHARS);
  if (text) lines.push(text);
  return lines.join("\n");
}

// Blocco da inserire nelle istruzioni dell'AI.
export function formatRulesForPrompt(platformRules: PlatformRule[], agencyBlock: string): string {
  const active = platformRules.filter((rule) => rule.enabled !== false && rule.body.trim());
  const platformPart = active.length
    ? `REGOLE GENERALI DELLA PIATTAFORMA (valgono sempre):\n${active.map((rule, i) => `${i + 1}. ${rule.body.trim()}`).join("\n")}`
    : "";
  const agencyPart = agencyBlock.trim()
    ? `REGOLE DI QUESTA AGENZIA (preferenze dell'agenzia: seguile. Per tono, lunghezza e stile di scrittura prevalgono sulle regole generali, ma non permettono mai di inventare dati né di ignorare le altre regole generali):\n${agencyBlock.trim()}`
    : "";
  return [platformPart, agencyPart].filter(Boolean).join("\n\n");
}
