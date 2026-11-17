"use client";

import { useEffect, useRef } from "react";
import { clearOfflineData } from "@/lib/offlineDocs";

// Attiva il funzionamento senza rete dell'area clienti (le pagine già aperte
// restano consultabili) registrando il service worker.
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

// Pulsante "Esci" che prima cancella dal telefono pagine e documenti salvati.
export function ClientSignOutForm({
  action,
  className,
}: {
  action: () => Promise<void> | void;
  className?: string;
}) {
  const cleared = useRef(false);
  return (
    <form
      action={action}
      onSubmit={async (event) => {
        if (cleared.current) return;
        event.preventDefault();
        const form = event.currentTarget;
        await clearOfflineData();
        cleared.current = true;
        form.requestSubmit();
      }}
    >
      <button type="submit" className={className}>
        Esci
      </button>
    </form>
  );
}
