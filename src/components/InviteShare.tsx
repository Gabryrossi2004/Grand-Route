"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { inviteMessage } from "@/lib/referral";

// Il tuo link d'invito: copia, WhatsApp o email (nessun invito parte da solo: scegli tu a chi mandarlo)
export default function InviteShare({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const text = inviteMessage(link);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // selezione manuale: il campo è già selezionabile
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Il tuo link d'invito"
          className="min-w-0 flex-1 rounded-xl border border-[#e6d7bb] bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-[#cda876]"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17283f]"
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? "Copiato!" : "Copia il link"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#233c5e] px-4 py-2 text-sm font-medium text-[#233c5e] transition hover:bg-[#233c5e] hover:text-white"
        >
          <MessageCircle size={16} aria-hidden /> WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent("Ti invito su Grand Route")}&body=${encodeURIComponent(text)}`}
          className="inline-flex items-center gap-2 rounded-full border border-[#233c5e] px-4 py-2 text-sm font-medium text-[#233c5e] transition hover:bg-[#233c5e] hover:text-white"
        >
          <Mail size={16} aria-hidden /> Email
        </a>
      </div>
    </div>
  );
}
