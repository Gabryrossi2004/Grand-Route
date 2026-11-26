"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Copy, Download, RefreshCw } from "lucide-react";
import { getCalendarToken, resetCalendarToken } from "@/lib/actions/agenda";

// Aggiungi i servizi al calendario del telefono: un link privato «in abbonamento» che si aggiorna da solo
export default function CalendarPanel() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, start] = useTransition();

  const origin = typeof window !== "undefined" ? window.location.origin : "https://grandroute.it";
  const https = token ? `${origin}/api/calendario/${token}.ics` : "";
  const webcal = https.replace(/^https?:/, "webcal:");

  const show = () => {
    setOpen((v) => !v);
    if (token || open) return;
    start(async () => {
      const r = await getCalendarToken();
      if (r.ok) setToken(r.token);
      else setError(r.error);
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(https);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Non riesco a copiare: tieni premuto sul link e copialo a mano.");
    }
  };

  const reset = () =>
    start(async () => {
      setError(null);
      const r = await resetCalendarToken();
      setConfirmReset(false);
      if (r.ok) setToken(r.token);
      else setError(r.error);
    });

  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold";
  return (
    <section className="mt-3 rounded-2xl border border-[#e6d7bb] bg-white p-4">
      <button type="button" onClick={show} aria-expanded={open} className="flex w-full items-center gap-3 rounded-xl text-left" data-nofx>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#faf3e6] text-[#233c5e]"><CalendarPlus size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[#233c5e]">Aggiungi al calendario del telefono</span>
          <span className="block text-sm text-slate-600">I servizi compaiono in Calendario (iPhone, Google, Outlook) e si aggiornano da soli.</span>
        </span>
      </button>
      {open && (
        <div className="mt-4 space-y-4 border-t border-[#f2e2c4] pt-4 text-sm text-slate-700">
          {!token && !error && <p>Preparo il tuo link…</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
          {token && (
            <>
              <div>
                <p className="font-semibold text-slate-900">iPhone, iPad e Mac</p>
                <p className="mt-0.5">Tocca il tasto e conferma «Iscriviti»: il calendario «Grand Route» resta sempre aggiornato.</p>
                <a href={webcal} className={`${btn} mt-2 bg-[#233c5e] text-white hover:bg-[#17283f]`}><CalendarPlus size={16} /> Aggiungi a Calendario</a>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Google Calendar (Android e computer)</p>
                <p className="mt-0.5">Copia il link, poi in Google Calendar: <em>Altri calendari → + → Da URL</em> e incollalo.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input readOnly value={https} onFocus={(e) => e.currentTarget.select()} aria-label="Link del calendario" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-[#faf7ee] px-3 py-2.5 text-xs text-slate-600" />
                  <button type="button" onClick={copy} className={`${btn} border border-[#e6d7bb] bg-white text-[#233c5e]`}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copiato" : "Copia il link"}</button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`${https}?scarica=1`} className={`${btn} border border-[#e6d7bb] bg-white text-[#233c5e]`}><Download size={16} /> Scarica il file (non si aggiorna)</a>
                {!confirmReset ? (
                  <button type="button" onClick={() => setConfirmReset(true)} className={`${btn} text-slate-600`}><RefreshCw size={16} /> Nuovo link</button>
                ) : (
                  <span className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
                    Il link attuale smetterà di funzionare. Continuare?
                    <button type="button" disabled={pending} onClick={reset} className="rounded-lg bg-[#233c5e] px-3 py-1.5 font-semibold text-white">Sì, genera</button>
                    <button type="button" onClick={() => setConfirmReset(false)} className="px-2 text-slate-600">Annulla</button>
                  </span>
                )}
              </div>
              <p className="rounded-lg bg-[#faf7ee] px-3 py-2 text-xs text-slate-600">
                Il link è privato, come una password: chi lo ha vede i tuoi servizi (clienti, luoghi, orari; non i prezzi). Non condividerlo; se lo perdi o cambi telefono, generane uno nuovo. Google e Apple aggiornano il calendario ogni tanto, non all&apos;istante.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
