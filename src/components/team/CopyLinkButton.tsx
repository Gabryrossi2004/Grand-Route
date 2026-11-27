"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export default function CopyLinkButton({ link, label = "Copia il link" }: { link: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch {
      window.prompt("Copia il link:", link);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 text-xs font-medium text-[#233c5e] transition hover:bg-[#faf3e6]"
    >
      <Copy size={13} aria-hidden /> {done ? "Copiato!" : label}
    </button>
  );
}
