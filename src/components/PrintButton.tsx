"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f]"
    >
      Stampa / Salva come PDF
    </button>
  );
}
