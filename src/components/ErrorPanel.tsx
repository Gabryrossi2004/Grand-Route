"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";

const RELOAD_KEY = "gr:reloaded-after-deploy";

// Errore tipico dopo un aggiornamento del sito: la pagina aperta usa ancora la versione
// precedente e il server non riconosce più le sue azioni. Basta ricaricare la pagina.
function isVersionMismatch(error: Error) {
  const text = `${error?.message ?? ""}`;
  return /Server Action|older or newer deployment|Failed to find|ChunkLoadError|Loading chunk/i.test(text);
}

// Schermata d'errore condivisa: messaggio chiaro, «Riprova» (rilegge i dati dal server senza
// ricaricare tutto) e «Ricarica la pagina». Dopo un aggiornamento del sito ricarica da sola.
export default function ErrorPanel({ error, reset, text }: { error: Error & { digest?: string }; reset: () => void; text: string }) {
  const router = useRouter();

  useEffect(() => {
    console.error("[errore pagina]", error);
    if (isVersionMismatch(error)) {
      try {
        // Una sola volta, per non entrare in un ciclo di ricariche
        const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last > 60_000) {
          window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }, [error]);

  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-[#e6d7bb] bg-white p-8 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <AlertTriangle size={24} />
      </span>
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Qualcosa è andato storto</h2>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={retry}
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
      {error?.digest && <p className="text-[11px] text-slate-400">Codice per l&apos;assistenza: {error.digest}</p>}
    </div>
  );
}
