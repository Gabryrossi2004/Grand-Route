import {
  BedDouble,
  CircleEllipsis,
  Compass,
  Plane,
  TrainFront,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { ActivityType } from "./types";

export const activityTypes: Record<ActivityType, { label: string; color: string; bg: string; icon: LucideIcon }> = {
  volo: { label: "Volo", color: "#2563eb", bg: "#eff6ff", icon: Plane },
  alloggio: { label: "Alloggio", color: "#7c3aed", bg: "#f5f3ff", icon: BedDouble },
  trasporto: { label: "Trasporto", color: "#ea580c", bg: "#fff7ed", icon: TrainFront },
  ristorante: { label: "Ristorante", color: "#dc2626", bg: "#fef2f2", icon: UtensilsCrossed },
  attivita: { label: "Attività", color: "#16a34a", bg: "#f0fdf4", icon: Compass },
  altro: { label: "Altro", color: "#64748b", bg: "#f8fafc", icon: CircleEllipsis },
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
  trasporto: [
    {
      key: "mezzo",
      label: "Mezzo",
      type: "select",
      options: ["Treno", "Bus", "Traghetto", "Transfer privato", "Altro"],
    },
    { key: "numero", label: "Numero treno / corsa", type: "text" },
    { key: "pnr", label: "PNR / Codice prenotazione", type: "text" },
    { key: "luogo_arrivo", label: "Luogo di arrivo", type: "text" },
    { key: "orario_arrivo", label: "Orario di arrivo", type: "time" },
  ],
  ristorante: [
    { key: "numero_persone", label: "Numero persone", type: "number" },
    { key: "note_prenotazione", label: "Note prenotazione", type: "text" },
  ],
  attivita: [
    { key: "punto_incontro", label: "Punto di incontro", type: "text" },
    { key: "durata", label: "Durata", type: "text" },
  ],
  altro: [],
};

export const detailFieldLabels: Record<string, string> = Object.values(detailFields)
  .flat()
  .reduce((acc, field) => ({ ...acc, [field.key]: field.label }), {} as Record<string, string>);

// Le chiavi che iniziano con "_" sono dati interni (es. usati per creare in
// automatico il blocco "Arrivo" di un volo) e non vanno mai mostrati.
export function visibleDetailEntries(details: Record<string, string> | null | undefined): [string, string][] {
  return Object.entries(details || {}).filter(([key]) => !key.startsWith("_"));
}
