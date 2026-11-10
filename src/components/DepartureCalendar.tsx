"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Trip } from "@/lib/types";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function DepartureCalendar({ trips }: { trips: Trip[] }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const tripsByDeparture = useMemo(() => {
    const map = new Map<string, Trip[]>();
    for (const trip of trips) {
      if (!trip.start_date) continue;
      const list = map.get(trip.start_date) ?? [];
      list.push(trip);
      map.set(trip.start_date, list);
    }
    return map;
  }, [trips]);

  const tripsByReturn = useMemo(() => {
    const map = new Map<string, Trip[]>();
    for (const trip of trips) {
      if (!trip.end_date) continue;
      const list = map.get(trip.end_date) ?? [];
      list.push(trip);
      map.set(trip.end_date, list);
    }
    return map;
  }, [trips]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = lunedì
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = viewDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const todayKey = toDateKey(today);

  const tripsWithoutDate = trips.filter((trip) => !trip.start_date);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize text-slate-900">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="rounded-md border border-slate-300 p-1.5 text-slate-500 transition hover:bg-slate-50"
            title="Mese precedente"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-md border border-[#2b333e]/30 px-3 py-1.5 text-xs font-medium text-[#2b333e] transition hover:bg-[#2b333e]/5"
          >
            Oggi
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="rounded-md border border-slate-300 p-1.5 text-slate-500 transition hover:bg-slate-50"
            title="Mese successivo"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[#e6d7bb] bg-slate-200">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-[#2b333e] px-2 py-1.5 text-center text-xs font-semibold text-white">
            {label}
          </div>
        ))}

        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-24 bg-white sm:min-h-28" />;
          const key = toDateKey(date);
          const departures = tripsByDeparture.get(key) ?? [];
          const returns = tripsByReturn.get(key) ?? [];
          const isToday = key === todayKey;

          return (
            <div key={i} className="min-h-24 bg-white p-1.5 sm:min-h-28">
              <span
                className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  isToday ? "bg-[#2b333e] font-semibold text-white" : "text-slate-500"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="flex flex-col gap-1">
                {departures.map((trip) => (
                  <Link
                    key={`dep-${trip.id}`}
                    href={`/dashboard/trips/${trip.id}`}
                    title={`Partenza: ${trip.title}`}
                    className="block truncate rounded bg-[#f2e2c4] px-1.5 py-0.5 text-[11px] font-medium text-[#182026] hover:bg-[#e6d7bb]"
                  >
                    ✈ {trip.title}
                  </Link>
                ))}
                {returns.map((trip) => (
                  <Link
                    key={`ret-${trip.id}`}
                    href={`/dashboard/trips/${trip.id}`}
                    title={`Rientro: ${trip.title}`}
                    className="block truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                  >
                    ↩ {trip.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {tripsWithoutDate.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Senza data assegnata</h3>
          <div className="flex flex-wrap gap-2">
            {tripsWithoutDate.map((trip) => (
              <Link
                key={trip.id}
                href={`/dashboard/trips/${trip.id}`}
                className="rounded-lg border border-[#e6d7bb] bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {trip.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
