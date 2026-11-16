import Link from "next/link";
import { Plane } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Trip, TripChecklistItem } from "@/lib/types";
import { formatEuro, getDisplayPrice } from "@/lib/price";

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  const [{ data: trips }, { count: clientsCount }] = await Promise.all([
    supabase.from("trips").select("*").eq("owner_id", user?.id ?? ""),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user?.id ?? ""),
  ]);

  const allTrips = (trips as Trip[]) || [];
  const tripIds = allTrips.map((trip) => trip.id);

  const [{ data: pendingItems }, { data: paidIncome }] = await Promise.all([
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
  ]);

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
      <div>
        <p className="eyebrow">Panoramica</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#233c5e] sm:text-4xl">I tuoi viaggi</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-[#e6d7bb] bg-white p-5">
            <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-[#233c5e]">{stat.value}</p>
            <p className="eyebrow mt-2 !text-[#8c7a5e]">{stat.label}</p>
          </div>
        ))}

        {/* L'incassato reale è il dato più importante (soldi già confermati, non
            una stima): unico riquadro pieno invece delle schede chiare uguali. */}
        <div className="bg-[#233c5e] p-5">
          <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-white">
            {formatEuro(incassatoReale)}
          </p>
          <p className="eyebrow mt-2 !text-[#e4cc98]">Incassato reale</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-[#e6d7bb] bg-white p-5">
          <h2 className="mb-3 border-b border-[#e6d7bb] pb-3 text-xl font-medium text-[#233c5e]">Prossime partenze</h2>
          {upcomingTrips.length === 0 ? (
            <p className="text-sm text-slate-400">Nessuna partenza in programma.</p>
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
          <Link
            href="/dashboard/calendar"
            className="mt-3 inline-block text-xs font-medium text-[#233c5e] hover:underline"
          >
            Apri il calendario completo →
          </Link>
        </section>

        <section className="border border-[#e6d7bb] bg-white p-5">
          <h2 className="mb-3 border-b border-[#e6d7bb] pb-3 text-xl font-medium text-[#233c5e]">Promemoria da fare</h2>
          {!pendingItems || pendingItems.length === 0 ? (
            <p className="text-sm text-slate-400">Nessun promemoria aperto. Tutto in ordine.</p>
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
                      <span className="shrink-0 truncate text-xs text-slate-400">{item.trips.title}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
