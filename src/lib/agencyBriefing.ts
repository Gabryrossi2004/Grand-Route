// Il "briefing" di Zefiro in Home: cosa merita attenzione oggi. Si calcola
// dai dati dell'agenzia, senza AI: è istantaneo e non costa nulla.

import { ENTRY_REQUIREMENTS, ID_CARD_OK } from "@/data/entryRequirements";

export type BriefingArea = "viaggi" | "contabilita";

export type BriefingItem = {
  id: string;
  area?: BriefingArea; // dove compare nel briefing (di base: Viaggi)
  tone: "alert" | "warn" | "info";
  text: string;
  href: string;
  score: number; // più alto = più urgente
};

type BriefingTrip = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  client_id: string | null;
  itinerary_stage?: string | null;
  destination?: string | null;
  countries?: string[] | null;
  auto_countries?: string[] | null;
};

type BriefingPayment = { trip_id: string; amount: number; due_date: string | null; paid_date: string | null; direction?: string | null };
type BriefingClient = {
  id: string;
  full_name: string;
  id_card_number: string | null;
  passport_number: string | null;
  passport_expiry?: string | null;
  date_of_birth?: string | null;
};

const regionName = new Intl.DisplayNames(["it"], { type: "region" });
const tripCountries = (t: BriefingTrip) => [...new Set([...(t.countries ?? []), ...(t.auto_countries ?? [])])];
const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
const addMonths = (iso: string, months: number) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

const euro = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const inDays = (n: number) => (n === 0 ? "oggi" : n === 1 ? "domani" : `tra ${n} giorni`);

export function buildBriefing(input: {
  today: string; // AAAA-MM-GG, in Italia
  trips: BriefingTrip[];
  payments: BriefingPayment[];
  clients: BriefingClient[];
  // riconferme ai fornitori ancora aperte per i prossimi giorni (scheda operativa)
  reconfirm?: { services: number; suppliers: number; label: string } | null;
}): BriefingItem[] {
  const { today, trips, payments, clients } = input;
  const t0 = dayNumber(today);
  const items: BriefingItem[] = [];
  const tripById = new Map(trips.map((t) => [t.id, t]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const link = (tripId: string) => `/dashboard/trips/${tripId}`;

  for (const trip of trips) {
    if (!trip.start_date) continue;
    const start = dayNumber(trip.start_date);
    const end = trip.end_date ? dayNumber(trip.end_date) : start;
    const daysToStart = start - t0;

    // Viaggi in corso
    if (t0 >= start && t0 <= end) {
      items.push({
        id: `live-${trip.id}`,
        tone: "info",
        text: `«${trip.title}» è in corso (giorno ${t0 - start + 1} di ${end - start + 1}).`,
        href: link(trip.id),
        score: 50,
      });
      continue;
    }
    if (daysToStart < 0) continue;

    // Partenze imminenti
    if (daysToStart <= 7) {
      items.push({
        id: `dep-${trip.id}`,
        tone: daysToStart <= 2 ? "warn" : "info",
        text: `«${trip.title}» parte ${inDays(daysToStart)}.`,
        href: link(trip.id),
        score: 70 - daysToStart,
      });
    }

    // Itinerario ancora preliminare a ridosso della partenza
    if (daysToStart <= 14 && trip.itinerary_stage !== "finale") {
      items.push({
        id: `prelim-${trip.id}`,
        tone: "warn",
        text: `«${trip.title}» parte ${inDays(daysToStart)} ma l'itinerario è ancora preliminare.`,
        href: link(trip.id),
        score: 80 - daysToStart,
      });
    }

    const codes = tripCountries(trip);
    const client = trip.client_id ? clientById.get(trip.client_id) : undefined;

    // Permessi d'ingresso da richiedere prima della partenza (ESTA, eTA, e-visa…)
    for (const code of codes) {
      const req = ENTRY_REQUIREMENTS[code];
      if (!req || daysToStart > req.days + 21) continue;
      items.push({
        id: `entry-${trip.id}-${code}`,
        tone: daysToStart <= req.days ? "warn" : "info",
        text: `«${trip.title}» (${regionName.of(code) ?? code}, parte ${inDays(daysToStart)}): ricorda al cliente ${req.doc} — ${req.how}.`,
        href: link(trip.id),
        score: 75 - Math.min(daysToStart, 60) / 2,
      });
    }

    // Passaporto: serve fuori dai paesi in cui basta la carta d'identità, valido 6 mesi oltre il rientro
    const needsPassport = codes.some((c) => !ID_CARD_OK.has(c));
    if (client && needsPassport && daysToStart <= 120) {
      const returnDate = trip.end_date ?? trip.start_date;
      if (client.passport_expiry && client.passport_expiry.slice(0, 10) < addMonths(returnDate, 6)) {
        items.push({
          id: `pass-${trip.id}`,
          tone: "alert",
          text: `Il passaporto di ${client.full_name} scade il ${shortDate(client.passport_expiry)}: per «${trip.title}» di solito serve una validità di almeno 6 mesi dopo il rientro.`,
          href: link(trip.id),
          score: 92 - daysToStart / 10,
        });
      } else if (!client.passport_number && client.id_card_number && daysToStart <= 60) {
        items.push({
          id: `pass-missing-${trip.id}`,
          tone: "warn",
          text: `Per «${trip.title}» serve il passaporto, ma di ${client.full_name} è registrata solo la carta d'identità.`,
          href: link(trip.id),
          score: 85 - daysToStart / 5,
        });
      }
    }

    // Documenti d'identità mancanti del cliente
    if (daysToStart <= 21 && trip.client_id) {
      if (client && !client.id_card_number && !client.passport_number) {
        items.push({
          id: `docs-${trip.id}`,
          tone: daysToStart <= 7 ? "alert" : "warn",
          text: `Mancano i documenti d'identità di ${client.full_name} per «${trip.title}» (parte ${inDays(daysToStart)}).`,
          href: link(trip.id),
          score: 90 - daysToStart,
        });
      }
    }
  }

  // Pagamenti da incassare: scaduti o in scadenza questa settimana
  for (const payment of payments) {
    if (payment.paid_date || !payment.due_date) continue;
    const trip = tripById.get(payment.trip_id);
    if (!trip) continue;
    const delta = dayNumber(payment.due_date) - t0;
    if (payment.direction === "pagamento") {
      if (delta <= 7) {
        items.push({
          area: "contabilita",
          id: `sup-${payment.trip_id}-${payment.due_date}-${payment.amount}`,
          tone: delta < 0 ? "alert" : delta <= 2 ? "warn" : "info",
          text:
            delta < 0
              ? `Pagamento a un fornitore di ${euro(payment.amount)} per «${trip.title}» scaduto da ${-delta} ${-delta === 1 ? "giorno" : "giorni"}.`
              : `Pagamento a un fornitore di ${euro(payment.amount)} per «${trip.title}» in scadenza ${inDays(delta)}.`,
          href: link(trip.id),
          score: delta < 0 ? 98 : 58 - delta,
        });
      }
      continue;
    }
    if (delta < 0) {
      items.push({
        area: "contabilita",
          id: `late-${payment.trip_id}-${payment.due_date}-${payment.amount}`,
        tone: "alert",
        text: `Pagamento di ${euro(payment.amount)} scaduto da ${-delta} ${-delta === 1 ? "giorno" : "giorni"} per «${trip.title}».`,
        href: link(trip.id),
        score: 100 + Math.min(-delta, 30),
      });
    } else if (delta <= 7) {
      items.push({
        area: "contabilita",
          id: `due-${payment.trip_id}-${payment.due_date}-${payment.amount}`,
        tone: delta <= 2 ? "warn" : "info",
        text: `Pagamento di ${euro(payment.amount)} per «${trip.title}» in scadenza ${inDays(delta)}.`,
        href: link(trip.id),
        score: 60 - delta,
      });
    }
  }

  // Compleanni dei clienti (oggi e nei prossimi 3 giorni)
  const year = Number(today.slice(0, 4));
  for (const client of clients) {
    if (!client.date_of_birth || !/^\d{4}-\d{2}-\d{2}/.test(client.date_of_birth)) continue;
    const [, m, d0] = client.date_of_birth.slice(0, 10).split("-").map(Number);
    const next = (y: number) => {
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const d = m === 2 && d0 === 29 && !leap ? 28 : d0;
      return dayNumber(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    };
    let delta = next(year) - t0;
    if (delta < 0) delta = next(year + 1) - t0;
    if (delta > 3) continue;
    items.push({
      id: `bday-${client.id}`,
      tone: "info",
      text: `Compleanno di ${client.full_name} ${inDays(delta)}: un messaggio di auguri?`,
      href: `/dashboard/clients/${client.id}`,
      score: 40 - delta,
    });
  }

  // Anniversari di viaggio: un anno fa (questa settimana) il cliente tornava da un viaggio
  for (const trip of trips) {
    if (!trip.end_date || !trip.client_id) continue;
    const ago = t0 - dayNumber(trip.end_date);
    if (ago < 365 || ago > 371) continue;
    const client = clientById.get(trip.client_id);
    if (!client) continue;
    items.push({
      id: `anniv-${trip.id}`,
      tone: "info",
      text: `Un anno fa ${client.full_name} tornava da «${trip.title}»: buon momento per proporre un nuovo viaggio.`,
      href: `/dashboard/clients/${client.id}`,
      score: 30,
    });
  }

  // Clienti che non viaggiano da più di 18 mesi (un solo promemoria riassuntivo)
  const lastTrip = new Map<string, number>();
  for (const trip of trips) {
    if (!trip.client_id) continue;
    const when = dayNumber(trip.end_date ?? trip.start_date ?? today);
    lastTrip.set(trip.client_id, Math.max(lastTrip.get(trip.client_id) ?? -Infinity, when));
  }
  const dormant = [...lastTrip.entries()].filter(([, last]) => t0 - last > 548);
  if (dormant.length > 0) {
    items.push({
      id: "dormant",
      tone: "info",
      text: `${dormant.length} ${dormant.length === 1 ? "cliente non viaggia" : "clienti non viaggiano"} con te da più di un anno e mezzo: ${dormant
        .slice(0, 3)
        .map(([id]) => clientById.get(id)?.full_name)
        .filter(Boolean)
        .join(", ")}${dormant.length > 3 ? "…" : ""}.`,
      href: "/dashboard/clients",
      score: 20,
    });
  }

  if (input.reconfirm && input.reconfirm.services > 0) {
    const r = input.reconfirm;
    items.push({
      id: "riconferme",
      tone: "warn",
      text: `Riconferme di ${r.label}: ${r.services} ${r.services === 1 ? "servizio" : "servizi"} di ${r.suppliers} ${r.suppliers === 1 ? "fornitore" : "fornitori"} ancora da riconfermare.`,
      href: "/dashboard/operativo?riconferme=1",
      score: 95,
    });
  }

  return items.sort((a, b) => b.score - a.score);
}

export function greetingFor(hour: number) {
  if (hour < 6) return "Buonanotte";
  if (hour < 13) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}

// ── Contabilità tra partner: fatture e ordini (dati dalla funzione network_accounting_briefing, migrazione 0068) ──
type BriefInvoice = { id: string; number: string | null; due_date: string | null; currency: string; counterpart: string; residuo: number; reminders_sent?: number };
export type AccountingBriefingData = {
  today?: string;
  to_pay?: BriefInvoice[];
  to_pay_total?: number;
  to_collect?: BriefInvoice[];
  drafts?: number;
  billable?: number;
  billable_clients?: number;
  extras_to_decide?: number;
  extras_contested?: number;
  orders_to_confirm_buyer?: number;
  orders_to_confirm_seller?: number;
};

const money = (n: number, currency: string) =>
  Number(n).toLocaleString("it-IT", { style: "currency", currency: currency || "EUR", minimumFractionDigits: 2 });
const days = (n: number) => `${n} ${n === 1 ? "giorno" : "giorni"}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildAccountingBriefing(d: AccountingBriefingData | null | undefined, today: string): BriefingItem[] {
  if (!d) return [];
  const t0 = dayNumber(today);
  const items: BriefingItem[] = [];
  const area = "contabilita" as const;

  for (const inv of d.to_pay ?? []) {
    const n = inv.number ? `n. ${inv.number} ` : "";
    const delta = inv.due_date ? dayNumber(inv.due_date) - t0 : null;
    items.push({
      id: `inv-pay-${inv.id}`,
      area,
      tone: delta == null ? "info" : delta < 0 ? "alert" : delta <= 2 ? "warn" : "info",
      text:
        delta != null && delta < 0
          ? `Fattura ${n}di ${inv.counterpart} da ${money(inv.residuo, inv.currency)} scaduta da ${days(-delta)}.`
          : delta != null
            ? `Fattura ${n}di ${inv.counterpart} da ${money(inv.residuo, inv.currency)} da pagare ${inDays(delta)}.`
            : `Fattura ${n}di ${inv.counterpart} da ${money(inv.residuo, inv.currency)} da pagare.`,
      href: `/dashboard/ordini/fatture/${inv.id}`,
      score: delta != null && delta < 0 ? 97 + Math.min(-delta, 20) / 10 : 57 - (delta ?? 7),
    });
  }
  const shownPay = (d.to_pay ?? []).length;
  const otherPay = (d.to_pay_total ?? 0) - shownPay;
  if (otherPay > 0) {
    items.push({
      id: "inv-pay-other",
      area,
      tone: "info",
      text: `${plural(otherPay, "altra fattura ricevuta", "altre fatture ricevute")} da pagare più avanti.`,
      href: "/dashboard/ordini?vista=fatture",
      score: 15,
    });
  }

  for (const inv of d.to_collect ?? []) {
    const n = inv.number ? `n. ${inv.number} ` : "";
    const late = inv.due_date ? t0 - dayNumber(inv.due_date) : 0;
    items.push({
      id: `inv-collect-${inv.id}`,
      area,
      tone: late > 15 ? "alert" : "warn",
      text: `${inv.counterpart} non ha ancora pagato la fattura ${n}(${money(inv.residuo, inv.currency)}), scaduta da ${days(late)}${inv.reminders_sent ? ` · ${plural(inv.reminders_sent, "sollecito inviato", "solleciti inviati")}` : ""}.`,
      href: `/rete/fatture/${inv.id}`,
      score: 90 + Math.min(late, 30) / 10,
    });
  }

  if ((d.billable ?? 0) > 0) {
    const b = d.billable ?? 0;
    const c = d.billable_clients ?? 1;
    items.push({
      id: "billable",
      area,
      tone: "warn",
      text: `${plural(b, "servizio svolto", "servizi svolti")} da fatturare${c > 1 ? ` a ${c} clienti` : ""}: la fattura si prepara da sola.`,
      href: "/rete/lavori",
      score: 70,
    });
  }
  if ((d.drafts ?? 0) > 0) {
    items.push({
      id: "drafts",
      area,
      tone: "info",
      text: `${plural(d.drafts ?? 0, "fattura in bozza", "fatture in bozza")} da controllare ed emettere.`,
      href: "/rete/fatture",
      score: 55,
    });
  }
  if ((d.extras_to_decide ?? 0) > 0) {
    items.push({
      id: "extras-decide",
      area,
      tone: "warn",
      text: `${plural(d.extras_to_decide ?? 0, "variazione di prezzo di un fornitore", "variazioni di prezzo dei fornitori")} da accettare o contestare (dopo 3 giorni valgono come accettate).`,
      href: "/dashboard/ordini",
      score: 88,
    });
  }
  if ((d.extras_contested ?? 0) > 0) {
    items.push({
      id: "extras-contested",
      area,
      tone: "warn",
      text: `Un cliente ha contestato ${plural(d.extras_contested ?? 0, "tua variazione di prezzo", "tue variazioni di prezzo")}: rivedile prima di fatturare.`,
      href: "/rete/lavori",
      score: 86,
    });
  }
  // Ordini da confermare: sono operativi, vanno tra i Viaggi
  if ((d.orders_to_confirm_buyer ?? 0) > 0) {
    items.push({
      id: "orders-buyer",
      area: "viaggi",
      tone: "warn",
      text: `${plural(d.orders_to_confirm_buyer ?? 0, "ordine a un fornitore aspetta", "ordini ai fornitori aspettano")} la tua conferma (modifiche o servizi registrati dal fornitore).`,
      href: "/dashboard/ordini",
      score: 84,
    });
  }
  if ((d.orders_to_confirm_seller ?? 0) > 0) {
    items.push({
      id: "orders-seller",
      area: "viaggi",
      tone: "warn",
      text: `${plural(d.orders_to_confirm_seller ?? 0, "richiesta di servizio da un partner aspetta", "richieste di servizio dai partner aspettano")} la tua conferma.`,
      href: "/rete/lavori",
      score: 83,
    });
  }
  return items;
}
