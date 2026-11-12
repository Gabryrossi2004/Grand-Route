"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

// Stesso scopo di trips/[id]/error.tsx, ma come rete di sicurezza per
// tutte le altre pagine della dashboard (clienti, libreria, calendario,
// impostazioni, ecc.), che altrimenti non avrebbero nessuna protezione.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Errore nella dashboard:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-[#e6d7bb] bg-white p-8 text-center shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <AlertTriangle size={24} />
        </span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">
            Qualcosa è andato storto
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Si è verificato un problema temporaneo. I dati già salvati non sono stati persi: prova a ricaricare.
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
    </div>
  );
}
