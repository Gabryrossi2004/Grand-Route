"use client";

import dynamic from "next/dynamic";

// L'editor di testo (circa 440 KB) si scarica solo quando serve davvero: aprendo un viaggio senza modificarlo non pesa sulla pagina.
const LazyRichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-28 animate-pulse rounded-md border border-slate-200 bg-slate-50" role="status" aria-label="Carico l'editor di testo…" />,
});

export default LazyRichTextEditor;
