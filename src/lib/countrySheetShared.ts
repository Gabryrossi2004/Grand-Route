// Parti della scheda paese che l'agenzia può far personalizzare a Zefiro (usato anche nel browser)
export const SHEET_SECTIONS = [
  { id: "description", label: "Frase iniziale e descrizione" },
  { id: "places", label: "Posti da visitare" },
  { id: "gettingAround", label: "Come muoversi" },
  { id: "food", label: "Da assaggiare" },
  { id: "tips", label: "Consigli pratici" },
  { id: "facts", label: "Scheda tecnica" },
] as const;
export type SheetSectionId = (typeof SHEET_SECTIONS)[number]["id"];

export type CustomizeOptions = {
  instructions: string;
  audience: string[];
  tone: "elegante" | "emozionale" | "pratico";
  length: "breve" | "uguale" | "dettagliata";
  sections: SheetSectionId[];
};
