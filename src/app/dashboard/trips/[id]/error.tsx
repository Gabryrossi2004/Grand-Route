"use client";

import ErrorPanel from "@/components/ErrorPanel";

// Rete di sicurezza della pagina del viaggio: messaggio chiaro e «Riprova» invece di una
// pagina vuota (o di un itinerario che sembra sparito).
export default function TripPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorPanel
      error={error}
      reset={reset}
      text="Si è verificato un problema temporaneo nel caricare il viaggio. I dati già salvati non sono stati persi: premi «Riprova»."
    />
  );
}
