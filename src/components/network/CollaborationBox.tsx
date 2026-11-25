"use client";

import { useState, useTransition } from "react";
import { Handshake } from "lucide-react";
import { endCollaboration, requestCollaboration, respondCollaboration } from "@/lib/actions/network";

export type CollabState = { id: string; status: string; direction: string } | null;

// Richiesta di collaborazione: se viene accettata, i dati di entrambi finiscono nella rubrica dell'altro
export default function CollaborationBox({ toUser, name, state }: { toUser: string; name: string; state: CollabState }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, ok: string) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) setDone(ok);
      else setError(r.error ?? "Errore");
    });

  const box = "rounded-2xl border border-[#e6d7bb] bg-white p-4";
  if (done) return <p className="rounded-xl bg-emerald-50 p-4 text-base text-emerald-800">{done}</p>;

  if (state?.status === "accettata")
    return (
      <div className={`${box} flex flex-wrap items-center justify-between gap-3`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Handshake size={18} /> Siete partner: i dati di {name} sono nella tua rubrica.</p>
        <button type="button" disabled={pending} onClick={() => run(() => endCollaboration(state.id), "Collaborazione terminata.")} className="text-xs font-medium text-slate-500 underline hover:text-slate-800">
          Termina la collaborazione
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>
    );

  if (state?.status === "in_attesa" && state.direction === "inviata")
    return (
      <div className={`${box} flex flex-wrap items-center justify-between gap-3`}>
        <p className="flex items-center gap-2 text-sm font-medium text-amber-700"><Handshake size={18} /> Richiesta di collaborazione inviata: in attesa di risposta.</p>
        <button type="button" disabled={pending} onClick={() => run(() => endCollaboration(state.id), "Richiesta annullata.")} className="text-xs font-medium text-slate-500 underline hover:text-slate-800">
          Annulla la richiesta
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>
    );

  if (state?.status === "in_attesa" && state.direction === "ricevuta")
    return (
      <div className={box}>
        <p className="flex items-center gap-2 text-sm font-semibold text-[#233c5e]"><Handshake size={18} /> {name} ti propone di collaborare.</p>
        <p className="mt-1 text-xs text-slate-500">Se accetti, i vostri dati vengono salvati nelle rispettive rubriche.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => run(() => respondCollaboration(state.id, true), "Collaborazione accettata: i dati sono stati salvati.")} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Accetta</button>
          <button type="button" disabled={pending} onClick={() => run(() => respondCollaboration(state.id, false), "Richiesta rifiutata.")} className="rounded-full border border-[#e6d7bb] px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Rifiuta</button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );

  return (
    <div className={box}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-[#c58f2d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#a87820]">
          <Handshake size={18} /> Proponi una collaborazione
        </button>
      ) : (
        <div>
          <label htmlFor="collab-msg" className="mb-1 block text-sm font-medium text-slate-700">Proponi una collaborazione a {name}</label>
          <textarea
            id="collab-msg"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={600}
            placeholder="Facoltativo: presentati in due righe e spiega come vorresti lavorare insieme."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
          />
          <p className="mt-1 text-xs text-slate-500">Se accetta, i dati dell&apos;attività di entrambi (nome, recapiti, partita IVA, sede) vengono salvati nelle rispettive rubriche, e tu ritrovi {name} in Anagrafiche → Fornitori.</p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => requestCollaboration(toUser, text), "Richiesta inviata. Ti avviseremo nei Messaggi quando risponde.")} className="rounded-full bg-[#233c5e] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? "Invio…" : "Invia la proposta"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600">Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}
