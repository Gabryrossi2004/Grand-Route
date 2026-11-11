"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Trip, TripGroup } from "@/lib/types";
import TripCard from "@/components/TripCard";

type StatusFilter = "tutti" | "pubblicati" | "bozze";

// Mostra un'unica card per ogni gruppo di varianti (la più vecchia, di
// solito l'originale), con un'etichetta "N varianti": altrimenti con
// qualche gruppo e tante varianti create nel tempo la lista diventerebbe
// caotica. Le altre varianti restano raggiungibili dalla sezione dedicata
// dentro la pagina del viaggio.
export default function TripsList({ trips, groups }: { trips: Trip[]; groups: TripGroup[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("tutti");

  const displayTrips = useMemo((): (Trip & { variantCount?: number })[] => {
    const representatives: (Trip & { variantCount?: number })[] = [];
    for (const group of groups) {
      const groupTrips = [...trips]
        .filter((trip) => trip.group_id === group.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (groupTrips.length > 0) {
        representatives.push({ ...groupTrips[0], variantCount: groupTrips.length });
      }
    }
    const standalone: (Trip & { variantCount?: number })[] = trips.filter((trip) => !trip.group_id);
    return [...representatives, ...standalone].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [trips, groups]);

  const filteredTrips = useMemo(() => {
    const q = query.trim().toLowerCase();
    return displayTrips.filter((trip) => {
      if (status === "pubblicati" && !trip.is_published) return false;
      if (status === "bozze" && trip.is_published) return false;
      if (!q) return true;
      const haystack = `${trip.title} ${trip.destination ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [displayTrips, query, status]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "tutti", label: "Tutti" },
    { value: "pubblicati", label: "Pubblicati" },
    { value: "bozze", label: "Bozze" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per titolo o destinazione…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[#e6d7bb] bg-white p-1">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                status === option.value ? "bg-[#233c5e] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">Non hai ancora creato nessun viaggio.</p>
          <Link href="/dashboard/trips/new" className="mt-3 inline-block text-sm font-medium text-[#233c5e] hover:underline">
            Crea il primo viaggio
          </Link>
        </div>
      ) : filteredTrips.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun viaggio corrisponde alla ricerca.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} variantCount={trip.variantCount} />
          ))}
        </div>
      )}
    </div>
  );
}
