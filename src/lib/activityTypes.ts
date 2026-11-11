import {
  Airplane,
  Bed,
  Boat,
  Car,
  Compass,
  DotsThreeCircle,
  ForkKnife,
  Info,
  Sailboat,
  Train,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { ActivityType } from "./types";

export const activityTypes: Record<ActivityType, { label: string; color: string; bg: string; icon: Icon }> = {
  volo: { label: "Volo", color: "#2563eb", bg: "#eff6ff", icon: Airplane },
  alloggio: { label: "Alloggio", color: "#7c3aed", bg: "#f5f3ff", icon: Bed },
  transfer: { label: "Transfer", color: "#ea580c", bg: "#fff7ed", icon: Car },
  treno: { label: "Treno", color: "#4f46e5", bg: "#eef2ff", icon: Train },
  traghetto: { label: "Traghetto", color: "#0d9488", bg: "#f0fdfa", icon: Boat },
  crociera: { label: "Crociera", color: "#db2777", bg: "#fdf2f8", icon: Sailboat },
  ristorante: { label: "Ristorante", color: "#dc2626", bg: "#fef2f2", icon: ForkKnife },
  attivita: { label: "Attività", color: "#16a34a", bg: "#f0fdf4", icon: Compass },
  info: { label: "Info", color: "#0891b2", bg: "#ecfeff", icon: Info },
  altro: { label: "Altro", color: "#64748b", bg: "#f8fafc", icon: DotsThreeCircle },
};

export const activityTypeOptions = Object.entries(activityTypes).map(([value, meta]) => ({
  value: value as ActivityType,
  ...meta,
}));

export type DetailField = {
  key: string;
  label: string;
  type: "text" | "time" | "date" | "number" | "select";
  options?: string[];
};

// Chiave speciale: quando presente in "details" per un alloggio, il sistema
// crea automaticamente i giorni mancanti fino a questa data e segna il check-out.
export const CHECK_OUT_DATE_KEY = "data_check_out";

// Campi extra specifici per ogni tipologia di attività. Vengono salvati dentro
// la colonna "details" (un contenitore flessibile), così ogni tipo può avere
// le sue informazioni senza bisogno di decine di colonne quasi sempre vuote.
export const detailFields: Record<ActivityType, DetailField[]> = {
  volo: [
    { key: "compagnia", label: "Compagnia aerea", type: "text" },
    { key: "numero_volo", label: "Numero volo", type: "text" },
    { key: "pnr", label: "PNR / Codice prenotazione", type: "text" },
    { key: "aeroporto_partenza", label: "Aeroporto di partenza", type: "text" },
    { key: "aeroporto_arrivo", label: "Aeroporto di arrivo", type: "text" },
    { key: "orario_arrivo", label: "Orario di arrivo", type: "time" },
  ],
  alloggio: [
    { key: "tipo_camera", label: "Tipologia camera", type: "text" },
    {
      key: "trattamento",
      label: "Trattamento",
      type: "select",
      options: ["Solo pernottamento", "B&B", "Mezza pensione", "Pensione completa", "All inclusive"],
    },
    { key: "check_in", label: "Orario check-in", type: "time" },
    { key: "check_out", label: "Orario check-out", type: "time" },
    { key: CHECK_OUT_DATE_KEY, label: "Data check-out", type: "date" },
    { key: "numero_conferma", label: "Numero di conferma", type: "text" },
  ],
  transfer: [
    { key: "fornitore", label: "Azienda / Autista", type: "text" },
    { key: "pnr", label: "Codice prenotazione", type: "text" },
    { key: "luogo_arrivo", label: "Luogo di arrivo", type: "text" },
    { key: "orario_arrivo", label: "Orario di arrivo", type: "time" },
  ],
  treno: [
    { key: "compagnia", label: "Compagnia", type: "text" },
    { key: "numero_treno", label: "Numero treno", type: "text" },
    { key: "pnr", label: "PNR / Codice prenotazione", type: "text" },
    { key: "carrozza_posto", label: "Carrozza / Posto", type: "text" },
    { key: "stazione_arrivo", label: "Stazione di arrivo", type: "text" },
    { key: "orario_arrivo", label: "Orario di arrivo", type: "time" },
  ],
  traghetto: [
    { key: "compagnia", label: "Compagnia", type: "text" },
    { key: "numero_corsa", label: "Numero corsa", type: "text" },
    { key: "pnr", label: "PNR / Codice prenotazione", type: "text" },
    { key: "porto_arrivo", label: "Porto di arrivo", type: "text" },
    { key: "orario_arrivo", label: "Orario di arrivo", type: "time" },
  ],
  crociera: [
    { key: "compagnia", label: "Compagnia crociere", type: "text" },
    { key: "nome_nave", label: "Nome nave", type: "text" },
    { key: "numero_cabina", label: "Numero cabina", type: "text" },
    { key: "porto_partenza", label: "Porto di partenza", type: "text" },
    { key: "porto_arrivo", label: "Porto di arrivo / sbarco", type: "text" },
  ],
  ristorante: [
    { key: "numero_persone", label: "Numero persone", type: "number" },
    { key: "note_prenotazione", label: "Note prenotazione", type: "text" },
  ],
  attivita: [
    { key: "punto_incontro", label: "Punto di incontro", type: "text" },
    { key: "durata", label: "Durata", type: "text" },
  ],
  info: [],
  altro: [],
};

// Chiave dei dettagli che rappresenta il "numero di conferma" per ogni
// tipologia (dove esiste): usata solo per sincronizzare automaticamente il
// numero di conferma dal pannello Servizi e fornitori all'attività collegata
// dell'itinerario, mai per generare testo.
export const confirmationDetailKey: Partial<Record<ActivityType, string>> = {
  volo: "pnr",
  alloggio: "numero_conferma",
  transfer: "pnr",
  treno: "pnr",
  traghetto: "pnr",
};

// Mappa "di riserva": usata solo come ultima spiaggia (es. per chiavi rimaste
// da un tipo precedente dopo un cambio di tipologia). Più tipologie possono
// condividere la stessa chiave (es. "pnr"): quando capita, vince l'ultima
// definizione incontrata, perciò per l'etichetta giusta va sempre preferita
// detailFieldLabel(tipo, chiave), che guarda prima nei campi di QUEL tipo.
export const detailFieldLabels: Record<string, string> = Object.values(detailFields)
  .flat()
  .reduce((acc, field) => ({ ...acc, [field.key]: field.label }), {} as Record<string, string>);

export function detailFieldLabel(type: ActivityType, key: string): string {
  const field = detailFields[type]?.find((f) => f.key === key);
  return field?.label ?? detailFieldLabels[key] ?? key;
}

// Le chiavi che iniziano con "_" sono dati interni (es. usati per creare in
// automatico il blocco "Arrivo" di un volo) e non vanno mai mostrati.
export function visibleDetailEntries(details: Record<string, string> | null | undefined): [string, string][] {
  return Object.entries(details || {}).filter(([key]) => !key.startsWith("_"));
}
