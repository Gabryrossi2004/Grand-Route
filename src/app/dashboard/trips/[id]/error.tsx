"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

// Rete di sicurezza: se qualcosa va storto mentre si lavora sull'itinerario
// (un salvataggio che fallisce, un errore imprevisto), senza questo file
// Next.js fa sparire tutta la pagina senza nessun messaggio, e l'unico modo
// per tornare a vederla è un refresh manuale del browser. Con questo file,
// invece, si vede un messaggio chiaro e un tasto "Riprova" che prova a
// ricaricare la pagina senza perdere il posto in cui si era.
export default function TripPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Errore nella pagina del viaggio:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-[#e6d7bb] bg-white p-8 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <AlertTriangle size={24} />
      </span>
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">
          Qualcosa è andato storto
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Si è verificato un problema temporaneo mentre si caricava la pagina del viaggio. Le attività già salvate non
          sono state perse: prova a ricaricare questa sezione.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 rounded-lg bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#17283f]"
        >
          <RefreshCw size={15} /> Riprova
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Ricarica la pagina
        </button>
      </div>
    </div>
  );
}
