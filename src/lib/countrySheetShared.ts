// Parti della scheda paese che l'agenzia può far personalizzare a Zefiro (usato anche nel browser)
export const SHEET_SECTIONS = [
  { id: "description", label: "Frase iniziale e descrizione" },
  { id: "places", label: "Posti da visitare" },
  { id: "gettingAround", label: "Come muoversi" },
  { id: "food", label: "Da assaggiare" },
  { id: "tips", label: "Consigli pratici" },
  { id: "facts", label: "Scheda tecnica" },
  { id: "areas", label: "Zone e periodi migliori" },
  { id: "experiences", label: "Cosa fare" },
  { id: "itineraries", label: "Itinerari consigliati" },
  { id: "agentTips", label: "Consigli per l'agente" },
] as const;
export type SheetSectionId = (typeof SHEET_SECTIONS)[number]["id"];

export type CustomizeOptions = {
  instructions: string;
  audience: string[];
  tone: "elegante" | "emozionale" | "pratico";
  length: "breve" | "uguale" | "dettagliata";
  sections: SheetSectionId[];
};

// Calendario delle zone: 12 lettere da gennaio a dicembre
export const SEASON_LEVELS: Record<string, { label: string; bg: string; fg: string }> = {
  O: { label: "Ottimo", bg: "#2f8a4f", fg: "#ffffff" },
  B: { label: "Buono", bg: "#9fd3a6", fg: "#14361f" },
  D: { label: "Variabile", bg: "#f4dc8a", fg: "#5a4500" },
  X: { label: "Sconsigliato", bg: "#e7a3a0", fg: "#5c1512" },
};
export const MONTHS_SHORT = ["G", "F", "M", "A", "M", "G", "L", "A", "S", "O", "N", "D"];
export const MONTHS_LONG = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
