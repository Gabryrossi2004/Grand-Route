"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Library } from "lucide-react";
import type { ActivityTemplate } from "@/lib/types";
import LibraryGrid from "@/components/LibraryGrid";

export default function LibraryPanel({ templates }: { templates: ActivityTemplate[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Apri la libreria"
        className="sticky top-20 flex shrink-0 flex-col items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-1.5 py-3 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
      >
        <ChevronLeft size={16} />
        <Library size={16} />
        <span className="[writing-mode:vertical-rl] text-xs font-medium">Libreria</span>
      </button>
    );
  }

  return (
    <div className="sticky top-20 flex max-h-[calc(100vh-6rem)] w-full shrink-0 flex-col self-start overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:w-80">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-medium text-slate-900">
          <Library size={16} /> Libreria
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Chiudi la libreria"
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Le attività che hai salvato per riusarle in altri viaggi. Per aggiungerne una, apri un&apos;attività e
        clicca l&apos;icona del segnalibro.
      </p>
      <LibraryGrid templates={templates} compact />
    </div>
  );
}
