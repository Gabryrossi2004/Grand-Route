"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, X } from "lucide-react";
import MiniDatePicker, { type PickerPosition } from "@/components/MiniDatePicker";

function formatDisplay(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

const POPOVER_WIDTH = 304; // 19rem
const POPOVER_HEIGHT = 400; // altezza massima approssimata, per decidere se aprirlo sopra

// Campo data con il calendario del sito al posto di quello del browser.
// Funziona come un normale <input type="date">: il valore (AAAA-MM-GG) viene
// inviato col form nel campo "name". Può essere non controllato
// (defaultValue) oppure controllato (value + onChange).
export default function DateField({
  id,
  name,
  defaultValue,
  value,
  onChange,
  className,
  placeholder = "Scegli una data",
  openAt,
  highlightFrom,
  highlightTo,
}: {
  id?: string;
  name: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
  openAt?: string | null;
  highlightFrom?: string | null;
  highlightTo?: string | null;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PickerPosition>({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function setValue(next: string) {
    setInner(next);
    onChange?.(next);
  }

  function computePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < POPOVER_HEIGHT && rect.top > spaceBelow) {
      setPos({ left, bottom: window.innerHeight - rect.top + 8 });
    } else {
      setPos({ left, top: rect.bottom + 8 });
    }
  }

  useEffect(() => {
    if (!open) return;
    computePosition();
    window.addEventListener("resize", computePosition);
    window.addEventListener("scroll", computePosition, true);
    return () => {
      window.removeEventListener("resize", computePosition);
      window.removeEventListener("scroll", computePosition, true);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name={name} value={current} />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 text-left ${className ?? ""} ${open ? "!border-[#cda876]" : ""}`}
      >
        <Calendar size={15} className="shrink-0 text-slate-500" />
        <span className={`min-w-0 flex-1 truncate ${current ? "text-slate-900" : "text-slate-500"}`}>
          {current ? formatDisplay(current) : placeholder}
        </span>
      </button>
      {current && (
        <button
          type="button"
          onClick={() => setValue("")}
          title="Cancella la data"
          aria-label="Cancella la data"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={13} />
        </button>
      )}
      {open && (
        <MiniDatePicker
          instant
          initialDate={current || null}
          openAt={openAt}
          highlightFrom={highlightFrom}
          highlightTo={highlightTo}
          fixedPos={pos}
          ignoreRef={wrapperRef}
          onCancel={() => setOpen(false)}
          onClear={() => {
            setValue("");
            setOpen(false);
          }}
          onConfirm={(iso) => {
            setValue(iso);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
