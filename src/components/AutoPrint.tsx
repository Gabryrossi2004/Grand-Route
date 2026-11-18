"use client";

import { useEffect } from "react";

// Apre da sola la finestra di stampa (da lì si sceglie "Salva come PDF"),
// quando le immagini sono caricate.
export default function AutoPrint() {
  useEffect(() => {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      setTimeout(() => window.print(), 600);
    };
    if (document.readyState === "complete") run();
    else window.addEventListener("load", run, { once: true });
    const fallback = setTimeout(run, 4000);
    return () => clearTimeout(fallback);
  }, []);
  return null;
}
