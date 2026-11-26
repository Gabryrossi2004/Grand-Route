// Statistiche del fornitore (funzione network_stats, migrazione 0070): tipi e periodi.
import { addDays } from "@/lib/orders/shared";

export type StatsData = {
  currency: string;
  from: string;
  to: string;
  now: { done: number; penalty: number; cancelled: number; declined: number; upcoming: number; pending: number; revenue: number; other: Record<string, number> };
  prev: { done: number; revenue: number };
  requests: { received: number; accepted: number; declined: number; avg_hours: number | null };
  top_clients: { name: string; services: number; amount: number }[];
  months: { month: string; services: number; revenue: number }[];
  invoices: { collected: number; avg_days_to_pay: number | null; outstanding: number; overdue_count: number; to_bill: number };
  profile: { views: number; views_prev: number; collab_received: number; collab_accepted: number; partners: number };
};

export const PERIODS = [
  { id: "mese", label: "Questo mese" },
  { id: "3mesi", label: "Ultimi 3 mesi" },
  { id: "anno", label: "Quest'anno" },
  { id: "12mesi", label: "Ultimi 12 mesi" },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];
export const isPeriod = (v: string | undefined): v is PeriodId => PERIODS.some((p) => p.id === v);

const monthStart = (iso: string, back: number) => {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1, 12));
  return d.toISOString().slice(0, 10);
};
const monthEnd = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
};

// Intervallo in mesi interi (fino a fine mese, così contano anche i servizi già in programma)
export function periodRange(id: PeriodId, today: string): { from: string; to: string } {
  const to = monthEnd(today);
  if (id === "mese") return { from: monthStart(today, 0), to };
  if (id === "3mesi") return { from: monthStart(today, 2), to };
  if (id === "anno") return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  return { from: monthStart(today, 11), to };
}

export const isBefore = (a: string, b: string) => a < b;
export { addDays };

// Variazione rispetto al periodo precedente, in parole
export function deltaText(cur: number, prev: number): { text: string; tone: "up" | "down" | "flat" } | null {
  if (!(prev > 0)) return cur > 0 ? { text: "primo periodo con dati", tone: "flat" } : null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: "come il periodo precedente", tone: "flat" };
  return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% sul periodo precedente`, tone: pct > 0 ? "up" : "down" };
}

export function hoursText(h: number | null): string {
  if (h == null) return "—";
  if (h < 1) return "meno di un'ora";
  if (h < 48) return `${Math.round(h)} ${Math.round(h) === 1 ? "ora" : "ore"}`;
  const d = Math.round(h / 24);
  return `${d} giorni`;
}

// Estremo «tondo» per l'asse del grafico (1, 2, 2,5, 5 × 10^n)
export function niceMax(v: number): number {
  if (!(v > 0)) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * exp) return m * exp;
  return 10 * exp;
}
