"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ClipboardCheck, Languages, PencilLine, Wand2 } from "lucide-react";
import AssistantIcon from "@/components/AssistantIcon";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { triggerZefiroAction, type ZefiroAction } from "@/components/ZefiroFloating";

// Le stesse azioni del personaggio, a portata di clic nell'intestazione dell'itinerario
// (utili anche se Zefiro è nascosto).
export default function ZefiroTripMenu({ hasContent }: { hasContent: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const run = (action: ZefiroAction) => {
    setOpen(false);
    triggerZefiroAction(action);
  };
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-[#f1e6cf]";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-[#cda876]/60 bg-[#faf3e6]/90 px-3.5 py-2 text-sm font-semibold text-[#233c5e] transition hover:bg-[#f2e2c4]"
      >
        <AssistantIcon size={18} />
        {ASSISTANT_NAME}
        <ChevronDown size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-[#e6d7bb] bg-[#faf3e6] p-1.5 shadow-lg">
          <button type="button" role="menuitem" className={item} onClick={() => run("trip-generate")}>
            <Wand2 size={16} /> {hasContent ? "Genera altre proposte" : "Genera un itinerario"}
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => run("trip-edit")}>
            <PencilLine size={16} /> Modifica a parole
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => run("trip-review")}>
            <ClipboardCheck size={16} /> Controlla il viaggio
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => run("trip-translate")}>
            <Languages size={16} /> Traduci il viaggio
          </button>
        </div>
      )}
    </div>
  );
}
