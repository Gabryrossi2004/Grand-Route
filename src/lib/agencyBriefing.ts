// Il "briefing" di Zefiro in Home: cosa merita attenzione oggi. Si calcola
// dai dati dell'agenzia, senza AI: è istantaneo e non costa nulla.

export type BriefingItem = {
  id: string;
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
};

type BriefingPayment = { trip_id: string; amount: number; due_date: string | null; paid_date: string | null };
type BriefingClient = { id: string; full_name: string; id_card_number: string | null; passport_number: string | null };

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

    // Documenti d'identità mancanti del cliente
    if (daysToStart <= 21 && trip.client_id) {
      const client = clientById.get(trip.client_id);
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
    if (delta < 0) {
      items.push({
        id: `late-${payment.trip_id}-${payment.due_date}-${payment.amount}`,
        tone: "alert",
        text: `Pagamento di ${euro(payment.amount)} scaduto da ${-delta} ${-delta === 1 ? "giorno" : "giorni"} per «${trip.title}».`,
        href: link(trip.id),
        score: 100 + Math.min(-delta, 30),
      });
    } else if (delta <= 7) {
      items.push({
        id: `due-${payment.trip_id}-${payment.due_date}-${payment.amount}`,
        tone: delta <= 2 ? "warn" : "info",
        text: `Pagamento di ${euro(payment.amount)} per «${trip.title}» in scadenza ${inDays(delta)}.`,
        href: link(trip.id),
        score: 60 - delta,
      });
    }
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function greetingFor(hour: number) {
  if (hour < 6) return "Buonanotte";
  if (hour < 13) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}
