import type { ActivityType } from "./types";

export const activityTypes: Record<ActivityType, { label: string; color: string; bg: string }> = {
  volo: { label: "Volo", color: "#2563eb", bg: "#eff6ff" },
  alloggio: { label: "Alloggio", color: "#7c3aed", bg: "#f5f3ff" },
  trasporto: { label: "Trasporto", color: "#ea580c", bg: "#fff7ed" },
  ristorante: { label: "Ristorante", color: "#dc2626", bg: "#fef2f2" },
  attivita: { label: "Attività", color: "#16a34a", bg: "#f0fdf4" },
  altro: { label: "Altro", color: "#64748b", bg: "#f8fafc" },
};

export const activityTypeOptions = Object.entries(activityTypes).map(([value, meta]) => ({
  value: value as ActivityType,
  ...meta,
}));
