import type { ServiceStatus, SupplierCategory } from "./types";

export const serviceStatuses: Record<ServiceStatus, { label: string; color: string; bg: string }> = {
  da_prenotare: { label: "Da prenotare", color: "#64748b", bg: "#f8fafc" },
  richiesto: { label: "Richiesto", color: "#d97706", bg: "#fffbeb" },
  confermato: { label: "Confermato", color: "#16a34a", bg: "#f0fdf4" },
  cancellato: { label: "Cancellato", color: "#dc2626", bg: "#fef2f2" },
};

export const serviceStatusOptions = Object.entries(serviceStatuses).map(([value, meta]) => ({
  value: value as ServiceStatus,
  ...meta,
}));

export const supplierCategories: Record<SupplierCategory, string> = {
  alloggio: "Alloggio",
  trasporto: "Trasporto",
  attivita: "Attività/Escursione",
  ristorazione: "Ristorazione",
  altro: "Altro",
};

export const supplierCategoryOptions = Object.entries(supplierCategories).map(([value, label]) => ({
  value: value as SupplierCategory,
  label,
}));
