"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white print:hidden">
      <Printer size={16} /> Stampa o salva in PDF
    </button>
  );
}
