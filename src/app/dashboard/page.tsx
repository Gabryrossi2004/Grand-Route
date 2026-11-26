import Link from "next/link";
import ZefiroBriefing from "@/components/ZefiroBriefing";
import ContactTodayCard from "@/components/ContactTodayCard";
import { Suspense } from "react";
import DepartureCalendar from "@/components/DepartureCalendar";
import { buildAccountingBriefing, buildBriefing, type AccountingBriefingData } from "@/lib/agencyBriefing";
import { riconfermaDays } from "@/lib/opsSheet";
import { romeToday } from "@/lib/destinationInfo";
import { Plane } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Trip, TripChecklistItem } from "@/lib/types";
import { formatEuro, getDisplayPrice } from "@/lib/price";
import GettingStarted from "@/components/GettingStarted";
import { agencySteps, type OnboardingStatus } from "@/lib/onboarding";

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

export default async function DashboardHomePage({ searchParams }: { searchParams: Promise<{ iniziare?: string }> }) {
  const supabase = await createClient();
  const user = await getCachedUser();
  // «Per iniziare» dal menu Account: la lista si riapre
  if ((await searchParams).iniziare) await supabase.rpc("set_onboarding_hidden", { p_hidden: false });

  const [{ data: trips }, { count: clientsCount }] = await Promise.all([
    supabase.from("trips").select("*").eq("owner_id", user?.id ?? ""),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user?.id ?? ""),
  ]);

  const allTrips = (trips as Trip[]) || [];
  const tripIds = allTrips.map((trip) => trip.id);

  // Riconferme ai fornitori ancora aperte (scheda operativa; niente se la tabella non c'è ancora):
  // parte insieme alle altre richieste, non dopo, per non allungare l'attesa.
  const reconfirmDays = riconfermaDays(romeToday());
  const [{ data: pendingItems }, { data: paidIncome }, { data: unreadClientMessages }, { data: dueIncome }, { data: briefingClients }, { data: openReconfirm }, { data: accounting }, { data: onboarding }] = await Promise.all([
    tripIds.length
      ? supabase
          .from("trip_checklist_items")
          .select("*, trips(title)")
          .in("trip_id", tripIds)
          .eq("done", false)
          .order("created_at", { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] }),
    tripIds.length
      ? supabase
          .from("trip_payments")
          .select("amount")
          .in("trip_id", tripIds)
          .eq("direction", "incasso")
          .not("paid_date", "is", null)
      : Promise.resolve({ data: [] }),
    // Messaggi dei clienti non ancora letti (se la tabella non c'è, resta vuoto)
    tripIds.length
      ? supabase
          .from("trip_messages")
          .select("trip_id")
          .in("trip_id", tripIds)
          .eq("author_role", "client")
          .is("read_at", null)
      : Promise.resolve({ data: [] }),
    // Pagamenti da incassare, per il briefing di Zefiro
    tripIds.length
      ? supabase
          .from("trip_payments")
          .select("trip_id, amount, due_date, paid_date, direction")
          .in("trip_id", tripIds)
          .is("paid_date", null)
          .not("due_date", "is", null)
      : Promise.resolve({ data: [] }),
    // Clienti dei viaggi (per sapere se mancano i documenti d'identità)
    allTrips.some((trip) => trip.client_id)
      ? supabase
          .from("clients")
          .select("id, full_name, id_card_number, passport_number, passport_expiry, date_of_birth")
          .eq("owner_id", user?.id ?? "")
      : Promise.resolve({ data: [] }),
    supabase
      .from("ops_rows")
      .select("supplier, status")
      .eq("owner_id", user?.id ?? "")
      .in("service_date", reconfirmDays)
      .neq("supplier", "")
      .not("status", "in", "(riconfermato,cancellato)")
      .limit(2000),
    // Fatture e ordini tra partner per la colonna «Contabilità» (vuoto se la migrazione 0068 non c'è ancora)
    supabase.rpc("network_accounting_briefing"),
    // Lista «Per iniziare» (vuota se la migrazione 0072 non c'è ancora)
    supabase.rpc("onboarding_status"),
  ]);
  const onboardingStatus = (onboarding as OnboardingStatus | null) ?? null;

  const reconfirmRows = (openReconfirm as { supplier: string; status: string }[] | null) ?? [];

  const briefing = buildBriefing({
    reconfirm: {
      services: reconfirmRows.length,
      suppliers: new Set(reconfirmRows.map((r) => r.supplier.trim().toLowerCase())).size,
      label:
        reconfirmDays.length > 1
          ? reconfirmDays
              .map((d) => new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long" }))
              .join(", ")
              .replace(/, (?=[^,]*$)/, " e ")
          : "domani",
    },
    today: romeToday(),
    trips: allTrips,
    payments: (dueIncome as { trip_id: string; amount: number; due_date: string | null; paid_date: string | null; direction: string }[] | null) ?? [],
    clients:
      (briefingClients as {
        id: string;
        full_name: string;
        id_card_number: string | null;
        passport_number: string | null;
        passport_expiry: string | null;
        date_of_birth: string | null;
      }[] | null) ?? [],
  });
  briefing.push(...buildAccountingBriefing(accounting as AccountingBriefingData | null, romeToday()));
  const romeHour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Rome" }));

  const unreadByTrip = new Map<string, number>();
  for (const row of (unreadClientMessages as { trip_id: string }[] | null) ?? []) {
    unreadByTrip.set(row.trip_id, (unreadByTrip.get(row.trip_id) ?? 0) + 1);
  }
  // Viaggi che aspettano qualcosa dal cliente o dall'agenzia: prima quelli in cui
  // il cliente ha chiesto modifiche o scritto, poi quelli in attesa di risposta.
  const clientAttention = allTrips
    .map((trip) => ({
      trip,
      unread: unreadByTrip.get(trip.id) ?? 0,
      status: trip.itinerary_stage === "finale" ? "none" : (trip.approval_status ?? "none"),
    }))
    .filter((item) => item.unread > 0 || item.status === "changes_requested" || item.status === "pending")
    .sort((a, b) => {
      const rank = (x: typeof a) => (x.status === "changes_requested" ? 0 : x.unread > 0 ? 1 : 2);
      return rank(a) - rank(b);
    })
    .slice(0, 8);

  const incassatoReale = ((paidIncome as { amount: number }[] | null) || []).reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );

  const publishedCount = allTrips.filter((trip) => trip.is_published).length;
  const draftCount = allTrips.length - publishedCount;

  const estimatedRevenue = allTrips.reduce((sum, trip) => {
    const price = getDisplayPrice(trip);
    return sum + (price?.total ?? 0);
  }, 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingTrips = allTrips
    .filter((trip) => trip.start_date && trip.start_date >= todayStr)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))
    .slice(0, 6);

  const stats = [
    { label: "Viaggi pubblicati", value: publishedCount },
    { label: "Viaggi in bozza", value: draftCount },
    { label: "Clienti in rubrica", value: clientsCount ?? 0 },
    { label: "Fatturato stimato", value: formatEuro(estimatedRevenue) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Panoramica</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#233c5e] sm:text-4xl">I tuoi viaggi</h1>
        </div>
        <Link href="/dashboard/statistiche" className="rounded-full border border-[#e6d7bb] bg-white px-4 py-1.5 text-sm font-medium text-[#233c5e] hover:bg-[#faf3e6]">
          Statistiche →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
            <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-[#233c5e]">{stat.value}</p>
            <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}

        {/* L'incassato reale è il dato più importante (soldi già confermati, non
            una stima): unico riquadro pieno invece delle schede chiare uguali. */}
        <div className="rounded-2xl bg-[#233c5e] p-5 shadow-sm shadow-[#233c5e]/30">
          <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-white">
            {formatEuro(incassatoReale)}
          </p>
          <p className="mt-1 text-sm text-[#cbbfa6]">Incassato reale</p>
        </div>
      </div>

      {onboardingStatus && !onboardingStatus.hidden && <GettingStarted steps={agencySteps(onboardingStatus)} />}

      <ZefiroBriefing items={briefing} hour={romeHour} />

      <Suspense fallback={null}>
        <ContactTodayCard ownerId={user?.id ?? ""} trips={allTrips} />
      </Suspense>

      {clientAttention.length > 0 && (
        <section className="rounded-2xl border border-[#cda876] bg-gradient-to-b from-[#fdf6e6] to-[#faf3e6] p-5 shadow-sm">
          <h2 className="mb-3 border-b border-[#e6d7bb] pb-3 text-xl font-medium text-[#233c5e]">Dai tuoi clienti</h2>
          <ul className="flex flex-col gap-1">
            {clientAttention.map(({ trip, unread, status }) => (
              <li key={trip.id}>
                <Link
                  href={`/dashboard/trips/${trip.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-white/70"
                >
                  <span className="min-w-0 truncate font-medium text-[#233c5e]">{trip.title}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {unread > 0 && (
                      <span className="rounded-full bg-[#233c5e] px-2 py-0.5 font-semibold text-white">
                        {unread} {unread === 1 ? "messaggio" : "messaggi"}
                      </span>
                    )}
                    {status === "changes_requested" && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 font-semibold text-orange-800">
                        Modifiche richieste
                      </span>
                    )}
                    {status === "pending" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                        In attesa del cliente
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
          <h2 className="mb-3 border-b border-[#e6d7bb] pb-3 text-xl font-medium text-[#233c5e]">Prossime partenze</h2>
          {upcomingTrips.length === 0 ? (
            <p className="text-sm text-slate-500">Nessuna partenza in programma.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {upcomingTrips.map((trip) => (
                <li key={trip.id}>
                  <Link
                    href={`/dashboard/trips/${trip.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-[#faf3e6]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{trip.title}</span>
                      {trip.destination && (
                        <span className="block truncate text-xs text-slate-500">{trip.destination}</span>
                      )}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs font-medium capitalize text-slate-500">
                      {dateLabel(trip.start_date!)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <a href="#calendario" className="mt-3 inline-block text-xs font-medium text-[#233c5e] hover:underline">
            Vai al calendario completo ↓
          </a>
        </section>

        <section className="rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
          <h2 className="mb-3 border-b border-[#e6d7bb] pb-3 text-xl font-medium text-[#233c5e]">Promemoria da fare</h2>
          {!pendingItems || pendingItems.length === 0 ? (
            <p className="text-sm text-slate-500">Nessun promemoria aperto. Tutto in ordine.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {(pendingItems as (TripChecklistItem & { trips: { title: string } | null })[]).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/dashboard/trips/${item.trip_id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-[#faf3e6]"
                  >
                    <span className="min-w-0 truncate text-sm text-slate-700">{item.label}</span>
                    {item.trips?.title && (
                      <span className="shrink-0 truncate text-xs text-slate-500">{item.trips.title}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section id="calendario" className="scroll-mt-24">
        <h2 className="mb-1 text-xl font-medium text-[#233c5e]">Calendario delle partenze</h2>
        <p className="mb-4 text-sm text-slate-500">Tutte le partenze (✈) e i rientri (↩) dei tuoi viaggi, mese per mese.</p>
        <DepartureCalendar trips={allTrips} />
      </section>

      {allTrips.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Plane size={24} className="mx-auto mb-2 text-slate-300" />
          <p className="text-slate-500">Non hai ancora creato nessun viaggio.</p>
          <Link href="/dashboard/trips/new" className="mt-2 inline-block text-sm font-medium text-[#233c5e] hover:underline">
            Crea il primo viaggio
          </Link>
        </div>
      )}
    </div>
  );
}
