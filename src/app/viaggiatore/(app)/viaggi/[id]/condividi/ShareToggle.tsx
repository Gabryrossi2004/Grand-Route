"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, MessageCircle } from "lucide-react";
import { setTripShare } from "@/app/viaggiatore/tripActions";

export default function ShareToggle({ tripId, slug, initialOn, title }: { tripId: string; slug: string; initialOn: boolean; title: string }) {
  const [on, setOn] = useState(initialOn);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const url = typeof window === "undefined" ? `/t/${slug}` : `${window.location.origin}/t/${slug}`;

  function toggle() {
    const next = !on;
    setError(null);
    start(async () => {
      const res = await setTripShare(tripId, next);
      if (!res.ok) setError(res.error);
      else setOn(next);
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia il link:", url);
    }
  }

  return (
    <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-[#233c5e]">
        <Link2 size={17} className="text-[#c58f2d]" /> Condividi il viaggio con gli amici
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        Con il link, chi viaggia con te vede il programma giorno per giorno sul telefono, senza registrarsi. <strong>Non vedono</strong> spese, valigia, foto e diario. Quando vuoi, spegni il link e smette di funzionare.
      </p>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={on} disabled={pending} onChange={toggle} className="h-5 w-5" />
        {on ? "Il link è attivo" : "Il link è spento"}
      </label>
      {on && (
        <div className="mt-4 flex flex-col gap-2">
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-slate-300 bg-[#faf7ee] px-3 py-2 text-sm text-slate-700" aria-label="Link del viaggio" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f]">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiato" : "Copia il link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Ecco il programma del nostro viaggio «${title}»: ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              <MessageCircle size={14} /> Manda su WhatsApp
            </a>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
