"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 rounded-full border border-white/40 px-3 py-1.5 text-xs font-medium hover:bg-white/10 print:hidden">
      <Printer size={14} /> Stampa / PDF
    </button>
  );
}
