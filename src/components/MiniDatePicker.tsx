"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Calendario compatto per scegliere una data: si naviga tra i mesi, si
// sceglie un giorno (resta evidenziato) e si conferma esplicitamente, senza
// chiudersi o inviare nulla finché non si preme "Conferma".
export default function MiniDatePicker({
  initialDate,
  onConfirm,
  onCancel,
}: {
  initialDate: string | null;
  onConfirm: (isoDate: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(initialDate);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const base = initialDate ? new Date(`${initialDate}T00:00:00`) : today;
  const [viewDate, setViewDate] = useState(new Date(base.getFullYear(), base.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = lunedì
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const monthLabel = viewDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const todayKey = toDateKey(today);

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl border border-[#e6d7bb] bg-white p-4 text-left normal-case shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="font-[family-name:var(--font-display)] text-base capitalize text-[#233c5e]">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            title="Mese precedente"
            className="rounded-md p-1 text-[#8c7a5e] transition hover:bg-[#faf3e6] hover:text-[#233c5e]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            title="Mese successivo"
            className="rounded-md p-1 text-[#8c7a5e] transition hover:bg-[#faf3e6] hover:text-[#233c5e]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="flex h-7 items-center justify-center text-xs font-semibold text-[#cda876]">
            {label}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const key = toDateKey(date);
          const isSelected = key === selected;
          const isToday = key === todayKey;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(key)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${
                isSelected
                  ? "bg-[#233c5e] font-semibold text-white"
                  : isToday
                    ? "font-semibold text-[#233c5e] ring-1 ring-inset ring-[#cda876]"
                    : "text-slate-600 hover:bg-[#faf3e6]"
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-[#f2e2c4] pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          Annulla
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="rounded-md bg-[#233c5e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Conferma
        </button>
      </div>
    </div>
  );
}
