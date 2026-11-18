"use client";

import ErrorPanel from "@/components/ErrorPanel";

// Rete di sicurezza per tutte le altre pagine della dashboard.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <ErrorPanel
        error={error}
        reset={reset}
        text="Si è verificato un problema temporaneo. I dati già salvati non sono stati persi: prova a ricaricare."
      />
    </div>
  );
}
