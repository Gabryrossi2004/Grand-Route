"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Ascolta i nuovi messaggi di un viaggio e aggiorna la pagina appena ne
// arriva uno. Se il tempo reale non è attivo (migrazione 0038) non succede
// nulla di male: resta l'aggiornamento periodico.
export function useTripRealtime(tripId: string, enabled = true) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    let cleanup: (() => void) | undefined;
    try {
      const supabase = createClient();
      const channel = supabase
        .channel(`trip-messages-${tripId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "trip_messages", filter: `trip_id=eq.${tripId}` },
          () => router.refresh(),
        )
        .subscribe();
      cleanup = () => {
        supabase.removeChannel(channel);
      };
    } catch {
      /* senza tempo reale si usa l'aggiornamento periodico */
    }
    return () => cleanup?.();
  }, [tripId, enabled, router]);
}
