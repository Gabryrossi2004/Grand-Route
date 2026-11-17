"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { costumeForDestination } from "@/lib/zefiroDestinations";
import type { ZefiroMode, ZefiroVariantId } from "@/lib/assistant";

type TripInfo = { destination: string | null; title: string | null } | null;

type ZefiroStyleValue = {
  variant: ZefiroVariantId; // il costume da indossare adesso
  mode: ZefiroMode; // la scelta dell'agenzia (può essere "dinamico")
  setTrip: (trip: TripInfo) => void; // chi mostra un viaggio dice a Zefiro dov'è
};

const ZefiroStyleContext = createContext<ZefiroStyleValue>({
  variant: "classico",
  mode: "classico",
  setTrip: () => {},
});

// Il costume di Zefiro, disponibile a tutti gli avatar del gestionale. Con
// "dinamico" dipende dal viaggio aperto in questo momento (destinazione o
// titolo); altrimenti resta quello scelto. I cambi si fanno con una breve
// pausa, per non far "lampeggiare" Zefiro scorrendo tante pagine in fretta.
export function ZefiroStyleProvider({ mode, children }: { mode: ZefiroMode; children: React.ReactNode }) {
  const [trip, setTrip] = useState<TripInfo>(null);

  const target: ZefiroVariantId =
    mode === "dinamico" ? (costumeForDestination(trip?.destination, trip?.title) ?? "classico") : mode;

  const [variant, setVariant] = useState<ZefiroVariantId>(target);
  useEffect(() => {
    if (target === variant) return;
    const timer = setTimeout(() => setVariant(target), mode === "dinamico" ? 120 : 0);
    return () => clearTimeout(timer);
  }, [target, variant, mode]);

  const value = useMemo(() => ({ variant, mode, setTrip }), [variant, mode]);
  return <ZefiroStyleContext.Provider value={value}>{children}</ZefiroStyleContext.Provider>;
}

export function useZefiroVariant() {
  return useContext(ZefiroStyleContext).variant;
}

export function useZefiroStyle() {
  return useContext(ZefiroStyleContext);
}

// Da mettere in una pagina che mostra un viaggio: dice a Zefiro la meta.
export function ZefiroDestination({ destination, title }: { destination: string | null; title: string | null }) {
  const { setTrip } = useContext(ZefiroStyleContext);
  useEffect(() => {
    setTrip({ destination, title });
    return () => setTrip(null);
  }, [destination, title, setTrip]);
  return null;
}
