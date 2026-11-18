"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

// Il link da condividere col cliente: scheda con l'indirizzo in evidenza e il tasto Copia.
export default function PublicLinkBar({ url, published }: { url: string; published: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copia il link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  if (!published) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#e6d7bb] px-4 py-3 text-sm text-slate-500">
          <Link2 size={16} className="shrink-0" aria-hidden />
          Pubblica il viaggio per ottenere il link da condividere col cliente.
        </div>
      </div>
    );
  }

  const shown = url.replace(/^https?:\/\//, "");
  const cut = shown.lastIndexOf("/") + 1;
  const base = shown.slice(0, cut);
  const slug = shown.slice(cut);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-[#e6d7bb] bg-[#faf3e6] px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#233c5e] text-[#f2e2c4]" aria-hidden>
          <Link2 size={18} />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-xs font-medium text-[#756548]">Link per il cliente</p>
          <p className="truncate text-[15px] text-slate-500" title={url}>
            {base}
            <span className="font-semibold text-[#233c5e]">{slug}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            copied ? "bg-green-600 text-white" : "bg-[#233c5e] text-white hover:bg-[#17283f]"
          }`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Link copiato" : "Copia link"}
        </button>
      </div>
    </div>
  );
}
