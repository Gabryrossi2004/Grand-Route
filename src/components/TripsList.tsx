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
// team: con la squadra, il filtro «I miei viaggi / Tutti» e il nome di chi segue ogni viaggio
export default function TripsList({
  trips,
  groups,
  team,
}: {
  trips: Trip[];
  groups: TripGroup[];
  team?: { userId: string; names: Record<string, string> } | null;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("tutti");
  const [mine, setMine] = useState(false);

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
      if (mine && team && trip.assigned_to !== team.userId) return false;
      if (!q) return true;
      const haystack = `${trip.title} ${trip.destination ?? ""} ${trip.code ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [displayTrips, query, status, mine, team]);

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "tutti", label: "Tutti" },
    { value: "pubblicati", label: "Pubblicati" },
    { value: "bozze", label: "Bozze" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per titolo, destinazione o codice…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {team && (
          <div className="flex items-center gap-1 rounded-lg border border-[#e6d7bb] bg-white p-1">
            {[
              { value: true, label: "I miei viaggi" },
              { value: false, label: "Tutti" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={mine === option.value}
                onClick={() => setMine(option.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  mine === option.value ? "bg-[#c58f2d] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
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
      </div>

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">Non hai ancora creato nessun viaggio.</p>
          <Link href="/dashboard/trips/new" className="mt-3 inline-block text-sm font-medium text-[#233c5e] hover:underline">
            Crea il primo viaggio
          </Link>
        </div>
      ) : filteredTrips.length === 0 ? (
        <p className="text-sm text-slate-500">
          {mine ? "Nessun viaggio assegnato a te: chiedi al titolare o assegnatelo dalla pagina del viaggio." : "Nessun viaggio corrisponde alla ricerca."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              variantCount={trip.variantCount}
              assignee={team && trip.assigned_to ? (team.names[trip.assigned_to] ?? null) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
