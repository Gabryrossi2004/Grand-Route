// Le bozze di messaggio che Zefiro scrive per l'agenzia, da rileggere e
// modificare prima di inviarle al cliente.
export type DraftKind = "conferma" | "promemoria" | "buonviaggio" | "dopoviaggio" | "risposta" | "migliora";

export const DRAFT_KINDS: { id: DraftKind; label: string; instruction: string }[] = [
  {
    id: "conferma",
    label: "Conferma del viaggio",
    instruction:
      "Scrivi il messaggio con cui l'agenzia conferma il viaggio al cliente: destinazione e date, un breve riassunto di cosa è previsto e i prossimi passi (documenti da controllare, eventuali pagamenti, dove trova tutti i dettagli: nella sua area clienti).",
  },
  {
    id: "promemoria",
    label: "Promemoria prima di partire",
    instruction:
      "Scrivi un promemoria pre-partenza: ricorda in modo gentile cosa serve prima di partire (documenti d'identità validi, pagamenti ancora da saldare con le scadenze che trovi nei dati, orario o primo appuntamento se noti) e che per ogni dubbio può scrivere in chat.",
  },
  {
    id: "buonviaggio",
    label: "Buon viaggio",
    instruction:
      "Scrivi un messaggio di buon viaggio, da mandare poco prima della partenza: augurio caloroso, il primo appuntamento o il volo se noti, e il numero di emergenza o il modo per contattare l'agenzia durante il viaggio se presente.",
  },
  {
    id: "dopoviaggio",
    label: "Dopo il viaggio",
    instruction:
      "Scrivi un messaggio per dopo il viaggio: ringrazia il cliente, chiedi com'è andata e se vuole lasciare un breve riscontro o suggerimenti, e invita con gentilezza a pensare al prossimo viaggio senza essere insistente.",
  },
  {
    id: "risposta",
    label: "Rispondi all'ultimo messaggio",
    instruction:
      "Scrivi una proposta di risposta all'ULTIMO messaggio del cliente nella conversazione, usando solo i dati del viaggio. Se serve un'informazione che non hai, scrivi tra parentesi quadre cosa l'agente deve verificare o aggiungere.",
  },
  {
    id: "migliora",
    label: "Migliora il mio testo",
    instruction:
      "Riscrivi il testo che l'agente ha già scritto (nelle NOTE DELL'AGENTE) in modo più chiaro, cortese e curato, mantenendo tutte le informazioni e senza aggiungerne di nuove.",
  },
];

export const MAX_DRAFT_NOTE = 1500;
