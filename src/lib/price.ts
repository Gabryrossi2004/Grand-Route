import type { Trip } from "./types";

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

export type DisplayPrice = {
  total: number;
  breakdown?: { net: number; commission: number };
};

// Cosa mostrare al cliente in base alla modalità scelta dall'agenzia.
// "nessuno" non mostra nulla, "lordo" mostra solo il totale,
// "commissioni" mostra anche come si compone (costo + commissione).
export function getDisplayPrice(trip: Trip): DisplayPrice | null {
  if (trip.price_mode === "lordo" && trip.price_amount != null) {
    return { total: trip.price_amount };
  }
  if (trip.price_mode === "commissioni" && trip.price_net != null && trip.price_commission != null) {
    return {
      total: trip.price_net + trip.price_commission,
      breakdown: { net: trip.price_net, commission: trip.price_commission },
    };
  }
  return null;
}
