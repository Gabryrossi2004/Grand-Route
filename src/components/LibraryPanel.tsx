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
        className="flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 sm:sticky sm:top-20 sm:w-auto sm:flex-col sm:items-center sm:gap-2 sm:self-start sm:px-1.5 sm:py-3"
      >
        <ChevronLeft size={16} className="hidden sm:block" />
        <Library size={16} />
        <span className="text-xs font-medium sm:[writing-mode:vertical-rl]">Libreria</span>
      </button>
    );
  }

  return (
    <div className="flex max-h-[70vh] w-full shrink-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:sticky sm:top-20 sm:max-h-[calc(100vh-6rem)] sm:w-80 sm:self-start">
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
