"use client";

import { useState } from "react";
import { Check, ExternalLink, Link2 } from "lucide-react";

// Copia il link pubblico del viaggio (al posto dell'indirizzo lungo sempre in vista).
export default function CopyLinkButton({ url }: { url: string }) {
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

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={copy}
        title={url}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#233c5e] transition hover:bg-[#f1e6cf]"
      >
        {copied ? <Check size={15} /> : <Link2 size={15} />}
        {copied ? "Link copiato" : "Copia link"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label="Apri il link pubblico"
        title="Apri il link pubblico"
        className="rounded-lg p-2 text-[#233c5e] transition hover:bg-[#f1e6cf]"
      >
        <ExternalLink size={15} />
      </a>
    </div>
  );
}
