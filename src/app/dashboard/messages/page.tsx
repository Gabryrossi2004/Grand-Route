import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import type { TripMessage } from "@/lib/types";

type TripRow = { id: string; title: string; clients: { full_name: string } | { full_name: string }[] | null };

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// Tutte le chat con i clienti, dalla più recente: un solo posto dove vedere
// chi ha scritto, senza aprire i viaggi uno per uno.
export default async function MessagesPage() {
  const supabase = await createClient();
  // Dati dell'agenzia (per un collaboratore: quelli dell'agenzia in cui lavora)
  const companyId = (await getTeamContext())?.companyId ?? "";

  const { data: trips } = await supabase
    .from("trips")
    .select("id, title, clients(full_name)")
    .eq("owner_id", companyId)
    .not("client_id", "is", null);
  const tripRows = (trips as TripRow[] | null) ?? [];
  const ids = tripRows.map((t) => t.id);

  const { data: messages } = ids.length
    ? await supabase
        .from("trip_messages")
        .select("*")
        .in("trip_id", ids)
        .order("created_at", { ascending: false })
        .limit(400)
    : { data: [] as TripMessage[] };

  const byTrip = new Map<string, { last: TripMessage; unread: number }>();
  for (const m of (messages as TripMessage[] | null) ?? []) {
    const entry = byTrip.get(m.trip_id) ?? { last: m, unread: 0 };
    if (m.author_role === "client" && !m.read_at) entry.unread++;
    byTrip.set(m.trip_id, entry);
  }

  const conversations = tripRows
    .filter((t) => byTrip.has(t.id))
    .map((t) => ({ trip: t, ...byTrip.get(t.id)! }))
    .sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));

  const clientName = (t: TripRow) => (Array.isArray(t.clients) ? t.clients[0]?.full_name : t.clients?.full_name);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">Chat</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#233c5e] sm:text-4xl">Messaggi dei clienti</h1>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-[#e6d7bb] bg-white p-8 text-center text-sm text-slate-500">
          <MessageCircle className="mx-auto mb-2 text-[#cda876]" />
          Nessuna conversazione ancora. Quando un cliente ti scrive dal suo viaggio, la trovi qui.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {conversations.map(({ trip, last, unread }) => (
            <li key={trip.id}>
              <Link
                href={`/dashboard/trips/${trip.id}?chat=1`}
                className="flex items-center gap-3 rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ee] px-4 py-3 shadow-sm transition hover:border-[#cda876]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate ${unread > 0 ? "font-semibold" : "font-medium"} text-[#233c5e]`}>
                      {clientName(trip) || "Cliente"} · {trip.title}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{when(last.created_at)}</span>
                  </span>
                  <span className={`mt-0.5 block truncate text-sm ${unread > 0 ? "text-slate-800" : "text-slate-500"}`}>
                    {last.author_role === "agency" ? "Tu: " : ""}
                    {last.body}
                  </span>
                </span>
                {unread > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#cda876] px-1.5 text-xs font-bold text-[#17283f]">
                    {unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
