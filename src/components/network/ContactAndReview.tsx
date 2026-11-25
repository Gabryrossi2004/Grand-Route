"use client";

import { useState, useTransition } from "react";
import { Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { reviewNetworkProfile, sendNetworkContact } from "@/lib/actions/network";

export function ContactForm({ toUser, name }: { toUser: string; name: string }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="rounded-xl bg-emerald-50 p-4 text-base text-emerald-800">{done}</p>;
  return (
    <div>
      <label htmlFor="contact-msg" className="mb-1 block text-sm font-medium text-slate-700">
        Scrivi a {name}
      </label>
      <textarea
        id="contact-msg"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={1000}
        placeholder="Presentati e spiega cosa ti serve: paese, date, numero di persone…"
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
      />
      <p className="mt-1 text-xs text-slate-500">Chi riceve vede il tuo nome, la tua attività e i tuoi recapiti, e ti risponde direttamente.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={pending || text.trim().length < 10}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await sendNetworkContact(toUser, text);
            if (r.ok) setDone("Richiesta inviata: riceverai la risposta ai recapiti del tuo profilo.");
            else setError(r.error ?? "Errore");
          })
        }
        className="mt-3 flex items-center gap-2 rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50"
      >
        <Send size={16} /> {pending ? "Invio…" : "Invia la richiesta"}
      </button>
    </div>
  );
}

// Valutazione anonima: solo positiva o negativa, nessun nome e nessun testo
export function ReviewButtons({ reviewed, mine, canReview }: { reviewed: string; mine: boolean | null; canReview: boolean }) {
  const [vote, setVote] = useState<boolean | null>(mine);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!canReview)
    return <p className="text-sm text-slate-500">Non puoi valutare chi svolge la tua stessa attività: le valutazioni vengono solo da chi lavora con questo professionista da un altro ruolo.</p>;
  const send = (v: boolean) =>
    start(async () => {
      setError(null);
      const next = vote === v ? null : v;
      const r = await reviewNetworkProfile(reviewed, next);
      if (r.ok) setVote(next);
      else setError(r.error ?? "Errore");
    });
  const btn = (v: boolean, on: string) =>
    `flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${vote === v ? on : "border-[#e6d7bb] bg-white text-slate-700 hover:border-[#c58f2d]"}`;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => send(true)} aria-pressed={vote === true} className={btn(true, "border-emerald-600 bg-emerald-600 text-white")}>
          <ThumbsUp size={16} /> Esperienza positiva
        </button>
        <button type="button" disabled={pending} onClick={() => send(false)} aria-pressed={vote === false} className={btn(false, "border-[#b0413e] bg-[#b0413e] text-white")}>
          <ThumbsDown size={16} /> Esperienza negativa
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Anonima: nessuno vede chi vota. I totali compaiono dal terzo voto. Tocca di nuovo per ritirare il voto.</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
