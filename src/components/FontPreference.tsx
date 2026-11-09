"use client";

import { useEffect } from "react";
import type { UiFontFamily, UiFontSize } from "@/lib/types";

const fontSizeScale: Record<UiFontSize, string> = {
  normale: "",
  grande: "112.5%",
  molto_grande: "125%",
};

// Applica la preferenza di dimensione/stile del carattere dell'agenzia a
// tutte le pagine del gestionale, agendo su <html> (i rem di Tailwind sono
// sempre relativi a lì). Si attiva solo mentre si naviga nel gestionale: al
// momento di uscire da queste pagine, ripristina i valori di default.
export default function FontPreference({
  fontSize,
  fontFamily,
}: {
  fontSize: UiFontSize;
  fontFamily: UiFontFamily;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = fontSizeScale[fontSize];
    root.dataset.uiFont = fontFamily;
    return () => {
      root.style.fontSize = "";
      delete root.dataset.uiFont;
    };
  }, [fontSize, fontFamily]);

  return null;
}
