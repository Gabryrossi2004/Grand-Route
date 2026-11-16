"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"];
const MONTH_LABELS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

// Formatta usando i componenti locali della data (anno/mese/giorno così come
// l'ha costruita "new Date(year, month, day)"), MAI passando per
// toISOString(): quella converte in UTC, e con un fuso avanti rispetto a UTC
// (come l'Italia) sposta la data indietro di un giorno.
function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type PickerPosition = { top?: number; bottom?: number; left: number };

type View = "days" | "months" | "years";

// Calendario per scegliere una data, nei colori del sito (crema, blu e oro).
// - Si naviga tra i mesi con le frecce; cliccando sul nome del mese o
//   sull'anno si salta rapidamente (comodo per le date di nascita).
// - Modalità "conferma" (predefinita): si sceglie un giorno e si preme
//   "Conferma". Modalità "instant": il giorno scelto vale subito.
// - Con "fixedPos" il calendario si apre in sovrapposizione (portale) e non
//   viene tagliato da finestre o pannelli con scorrimento.
export default function MiniDatePicker({
  initialDate,
  onConfirm,
  onCancel,
  instant = false,
  onClear,
  openAt,
  highlightFrom,
  highlightTo,
  fixedPos,
  ignoreRef,
}: {
  initialDate: string | null;
  onConfirm: (isoDate: string) => void;
  onCancel: () => void;
  instant?: boolean;
  onClear?: () => void;
  openAt?: string | null;
  highlightFrom?: string | null;
  highlightTo?: string | null;
  fixedPos?: PickerPosition;
  ignoreRef?: React.RefObject<HTMLElement | null>;
}) {
  const [selected, setSelected] = useState<string | null>(initialDate);
  const [view, setView] = useState<View>("days");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (ignoreRef?.current?.contains(target)) return;
      onCancel();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const startKey = initialDate || openAt || null;
  const base = startKey ? new Date(`${startKey}T00:00:00`) : today;
  const [viewDate, setViewDate] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const [yearPage, setYearPage] = useState(Math.floor(base.getFullYear() / 12) * 12);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = lunedì
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const monthName = viewDate.toLocaleDateString("it-IT", { month: "long" });
  const todayKey = toDateKey(today);

  function pick(key: string) {
    if (instant) {
      onConfirm(key);
    } else {
      setSelected(key);
    }
  }

  const navButton =
    "rounded-lg p-1.5 text-[#8c7a5e] transition hover:bg-[#faf3e6] hover:text-[#233c5e]";
  const titleButton =
    "rounded-lg px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[17px] text-[#233c5e] transition hover:bg-[#faf3e6]";

  const panel = (
    <div
      ref={containerRef}
      style={fixedPos ? { position: "fixed", zIndex: 70, ...fixedPos } : undefined}
      className={`${
        fixedPos ? "" : "absolute left-0 top-full z-30 mt-2"
      } picker-pop w-[19rem] rounded-2xl border border-[#e6d7bb] bg-white p-4 text-left normal-case shadow-[0_18px_40px_-12px_rgba(35,60,94,0.28)]`}
    >
      <div className="mb-3 flex items-center justify-between border-b border-[#f2e2c4] pb-3">
        {view === "days" && (
          <>
            <div className="flex items-baseline">
              <button type="button" onClick={() => setView("months")} className={`${titleButton} capitalize`}>
                {monthName}
              </button>
              <button type="button" onClick={() => setView("years")} className={`${titleButton} text-[#b08d57]`}>
                {year}
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                title="Mese precedente"
                className={navButton}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                title="Mese successivo"
                className={navButton}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </>
        )}
        {view === "months" && (
          <>
            <button type="button" onClick={() => { setYearPage(Math.floor(year / 12) * 12); setView("years"); }} className={titleButton}>
              {year}
            </button>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => setViewDate(new Date(year - 1, month, 1))} className={navButton} title="Anno precedente">
                <ChevronLeft size={17} />
              </button>
              <button type="button" onClick={() => setViewDate(new Date(year + 1, month, 1))} className={navButton} title="Anno successivo">
                <ChevronRight size={17} />
              </button>
            </div>
          </>
        )}
        {view === "years" && (
          <>
            <p className="px-1.5 font-[family-name:var(--font-display)] text-[17px] text-[#233c5e]">
              {yearPage} – {yearPage + 11}
            </p>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => setYearPage(yearPage - 12)} className={navButton} title="Anni precedenti">
                <ChevronLeft size={17} />
              </button>
              <button type="button" onClick={() => setYearPage(yearPage + 12)} className={navButton} title="Anni successivi">
                <ChevronRight size={17} />
              </button>
            </div>
          </>
        )}
      </div>

      {view === "days" && (
        <div className="grid grid-cols-7 gap-y-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="flex h-7 items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-[#b08d57]"
            >
              {label}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const key = toDateKey(date);
            const isSelected = key === selected;
            const isToday = key === todayKey;
            const inRange =
              !!highlightFrom && !!highlightTo && key > highlightFrom && key < highlightTo && !isSelected;
            const isRangeEdge = key === highlightFrom || key === highlightTo;
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(key)}
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                  isSelected
                    ? "bg-[#233c5e] font-semibold text-white"
                    : inRange
                      ? "bg-[#f2e2c4]/70 text-[#233c5e] hover:bg-[#f2e2c4]"
                      : isToday
                        ? "font-semibold text-[#233c5e] ring-1 ring-inset ring-[#cda876] hover:bg-[#faf3e6]"
                        : isRangeEdge
                          ? "font-semibold text-[#233c5e] hover:bg-[#faf3e6]"
                          : "text-slate-700 hover:bg-[#faf3e6]"
                }`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      )}

      {view === "months" && (
        <div className="grid grid-cols-3 gap-2">
          {MONTH_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setViewDate(new Date(year, index, 1));
                setView("days");
              }}
              className={`rounded-xl py-2.5 text-sm capitalize transition ${
                index === month
                  ? "bg-[#233c5e] font-semibold text-white"
                  : "text-slate-700 hover:bg-[#faf3e6]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {view === "years" && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                setViewDate(new Date(y, month, 1));
                setView("months");
              }}
              className={`rounded-xl py-2.5 text-sm transition ${
                y === year ? "bg-[#233c5e] font-semibold text-white" : "text-slate-700 hover:bg-[#faf3e6]"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#f2e2c4] pt-3">
        {instant ? (
          <>
            <button
              type="button"
              onClick={() => pick(todayKey)}
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-[#b08d57] transition hover:bg-[#faf3e6] hover:text-[#233c5e]"
            >
              Oggi
            </button>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg px-2 py-1.5 text-sm font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              >
                Cancella
              </button>
            )}
          </>
        ) : (
          <>
            <span />
            <div className="flex gap-2">
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
          </>
        )}
      </div>
    </div>
  );

  return fixedPos ? createPortal(panel, document.body) : panel;
}
