"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";

// Link personale «presenta un amico»: condivisione dal telefono o copia
export default function ShareInvite({ code, agency }: { code: string; agency: string }) {
  const [note, setNote] = useState<string | null>(null);
  const url = () => `${window.location.origin}/r/${code}`;
  const text = `Ti consiglio ${agency} per il tuo prossimo viaggio: lascia qui i tuoi contatti e ti richiamano loro.`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: agency, text, url: url() });
        return;
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
    }
    await copy();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text} ${url()}`);
      setNote("Link copiato: incollalo su WhatsApp o dove preferisci.");
    } catch {
      setNote(url());
    }
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={share} className="flex items-center gap-2 rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f]">
          <Share2 size={15} /> Invita un amico
        </button>
        <button type="button" onClick={copy} className="flex items-center gap-2 rounded-full border border-[#e6d7bb] bg-white px-4 py-2 text-sm font-medium text-[#233c5e] hover:bg-[#faf3e6]">
          <Copy size={15} /> Copia il link
        </button>
      </div>
      {note && <p className="mt-2 break-all text-xs text-slate-600">{note}</p>}
    </div>
  );
}
