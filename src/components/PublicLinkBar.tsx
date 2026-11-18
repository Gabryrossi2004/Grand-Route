"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";

// Il link da condividere col cliente, sempre leggibile, con copia e apertura.
export default function PublicLinkBar({ url, published }: { url: string; published: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copia il link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!published) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
        <Link2 size={16} className="shrink-0" />
        Pubblica il viaggio per ottenere il link da condividere col cliente.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-4">
      <Link2 size={16} className="shrink-0 text-[#233c5e]" aria-hidden />
      <span className="text-sm font-medium text-slate-700">Link per il cliente</span>
      <input
        readOnly
        value={url}
        aria-label="Link pubblico del viaggio"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 basis-60 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
      />
      <button
        type="button"
        onClick={copy}
        className="flex items-center gap-1.5 rounded-lg border border-[#233c5e] px-3 py-2 text-sm font-semibold text-[#233c5e] transition hover:bg-[#233c5e] hover:text-white"
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? "Copiato" : "Copia"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label="Apri il link pubblico"
        title="Apri il link pubblico"
        className="rounded-lg border border-slate-300 p-2 text-slate-700 transition hover:bg-slate-50"
      >
        <ExternalLink size={15} />
      </a>
    </div>
  );
}
