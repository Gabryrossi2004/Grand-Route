// Elenco dei modelli di messaggio: file leggero, usabile anche dal browser (senza i dati delle schede paese).
export type TemplateKind = "conferma" | "pagamento" | "documenti" | "valigia" | "buonviaggio" | "bentornato";

export const TEMPLATE_KINDS: { id: TemplateKind; label: string }[] = [
  { id: "conferma", label: "Conferma" },
  { id: "pagamento", label: "Sollecito pagamento" },
  { id: "documenti", label: "Documenti e visti" },
  { id: "valigia", label: "Lista per la partenza" },
  { id: "buonviaggio", label: "Buon viaggio" },
  { id: "bentornato", label: "Bentornato" },
];
