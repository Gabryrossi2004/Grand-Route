"use client";

import { createContext, useContext } from "react";
import type { ZefiroVariantId } from "@/lib/assistant";

// Il costume di Zefiro scelto dall'agenzia, disponibile a tutti gli avatar
// del gestionale senza doverlo passare a mano.
const ZefiroStyleContext = createContext<ZefiroVariantId>("classico");

export function ZefiroStyleProvider({ variant, children }: { variant: ZefiroVariantId; children: React.ReactNode }) {
  return <ZefiroStyleContext.Provider value={variant}>{children}</ZefiroStyleContext.Provider>;
}

export function useZefiroVariant() {
  return useContext(ZefiroStyleContext);
}
