import Link from "next/link";
import {
  CalendarClock,
  FileEdit,
  ListChecks,
  Plane,
  Rocket,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Trip, TripChecklistItem } from "@/lib/types";
import { formatEuro, getDisplayPrice } from "@/lib/price";

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: trips }, { count: clientsCount }] = await Promise.all([
    supabase.from("trips").select("*").eq("owner_id", user?.id ?? ""),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user?.id ?? ""),
  ]);

  const allTrips = (trips as Trip[]) || [];
  const tripIds = allTrips.map((trip) => trip.id);

  const { data: pendingItems } = tripIds.length
    ? await supabase
        .from("trip_checklist_items")
        .select("*, trips(title)")
        .in("trip_id", tripIds)
        .eq("done", false)
        .order("created_at", { ascending: true })
        .limit(8)
    : { data: [] };

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
    { label: "Viaggi pubblicati", value: publishedCount, icon: Rocket, color: "text-green-600", bg: "bg-green-50" },
    { label: "Viaggi in bozza", value: draftCount, icon: FileEdit, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Clienti in rubrica", value: clientsCount ?? 0, icon: Users, color: "text-[#2b333e]", bg: "bg-[#faf3e6]" },
    {
      label: "Fatturato stimato",
      value: formatEuro(estimatedRevenue),
      icon: Wallet,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="border-l-4 border-[#2b333e] pl-3 text-2xl font-semibold text-slate-900">Panoramica</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg} ${stat.color}`}>
              <stat.icon size={18} />
            </span>
            <p className="mt-3 text-2xl font-semibold text-slate-900">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock size={18} className="text-[#2b333e]" />
            <h2 className="text-lg font-semibold text-slate-900">Prossime partenze</h2>
          </div>
          {upcomingTrips.length === 0 ? (
            <p className="text-sm text-slate-400">Nessuna partenza in programma.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {upcomingTrips.map((trip) => (
                <li key={trip.id}>
                  <Link
                    href={`/dashboard/trips/${trip.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-slate-50"
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
            className="mt-3 inline-block text-xs font-medium text-[#2b333e] hover:underline"
          >
            Apri il calendario completo →
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ListChecks size={18} className="text-[#2b333e]" />
            <h2 className="text-lg font-semibold text-slate-900">Promemoria da fare</h2>
          </div>
          {!pendingItems || pendingItems.length === 0 ? (
            <p className="text-sm text-slate-400">Nessun promemoria aperto. Tutto in ordine.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {(pendingItems as (TripChecklistItem & { trips: { title: string } | null })[]).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/dashboard/trips/${item.trip_id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-slate-50"
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
          <Link href="/dashboard/trips/new" className="mt-2 inline-block text-sm font-medium text-[#2b333e] hover:underline">
            Crea il primo viaggio
          </Link>
        </div>
      )}
    </div>
  );
}
