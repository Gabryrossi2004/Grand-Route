// Agenda e Home dei fornitori: righe leggere dei servizi (funzione network_agenda, migrazione 0069) e date.
import { addDays, type OrderPhase } from "@/lib/orders/shared";

export type AgendaRow = {
  id: string;
  role: "seller" | "buyer";
  counterpart_name: string;
  counterpart_kind: string;
  counterpart_phone: string | null;
  last_edit_by: string;
  title: string;
  details: string | null;
  service_date: string;
  end_date: string | null;
  start_time: string | null;
  place: string | null;
  pax: number | null;
  reference: string | null;
  lead_name: string | null;
  status: "richiesto" | "confermato";
  phase: OrderPhase;
  amount: number;
  currency: string;
  thread_id: string | null;
};

// Tocca a me confermare (richiesta nuova o modifica fatta dall'altra parte)
export const waitingForMe = (r: Pick<AgendaRow, "status" | "phase" | "last_edit_by">, me: string) =>
  r.status === "richiesto" && r.phase === "da_confermare" && r.last_edit_by !== me;

// Il servizio occupa questo giorno (anche i servizi di più giorni)
export const onDay = (r: Pick<AgendaRow, "service_date" | "end_date">, day: string) => r.service_date <= day && (r.end_date ?? r.service_date) >= day;

// Lunedì della settimana che contiene il giorno
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // lunedì = 0
  return addDays(iso, -dow);
}

export const isIsoDate = (v: string | undefined | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

export const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { ...opts, timeZone: "UTC" });

export const mapsLink = (place: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

export const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// Intervallo dell'agenda: la settimana (lun–dom) oppure le settimane che coprono il mese
export function agendaRange(vista: "settimana" | "mese", ref: string) {
  let from: string;
  let to: string;
  let prev: string;
  let next: string;
  let title: string;
  if (vista === "settimana") {
    from = weekStart(ref);
    to = addDays(from, 6);
    prev = addDays(from, -7);
    next = addDays(from, 7);
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    title = `${dayLabel(from, sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" })} – ${dayLabel(to, { day: "numeric", month: "long", year: "numeric" })}`;
  } else {
    const first = `${ref.slice(0, 7)}-01`;
    const lastDay = new Date(Date.UTC(Number(ref.slice(0, 4)), Number(ref.slice(5, 7)), 0)).getUTCDate();
    const last = `${ref.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
    from = weekStart(first);
    to = addDays(weekStart(last), 6);
    prev = addDays(first, -1).slice(0, 7) + "-01";
    next = addDays(last, 1);
    title = dayLabel(first, { month: "long", year: "numeric" });
  }
  return { from, to, prev, next, title };
}
