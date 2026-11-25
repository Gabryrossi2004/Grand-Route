"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileSpreadsheet, Printer, RotateCcw } from "lucide-react";
import DateField from "@/components/DateField";
import { setInvoicePaid, voidInvoice } from "@/lib/actions/orders";
import { todayRome } from "@/lib/orders/shared";

const btn = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50";

// Azioni su una fattura emessa: scaricare l'XML, stampare, segnare pagata, stornare
export default function InvoiceActions({ id, role, status, canXml }: { id: string; role: "seller" | "buyer"; status: string; canXml: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paidDate, setPaidDate] = useState(todayRome());
  const [voiding, setVoiding] = useState(false);
  const [note, setNote] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Errore");
      else {
        setPaying(false);
        setVoiding(false);
        router.refresh();
      }
    });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canXml && (
          <a href={`/api/fatture/${id}/xml`} className={`${btn} bg-[#233c5e] text-white`}>
            <Download size={16} /> Scarica l&apos;XML (fattura elettronica)
          </a>
        )}
        <a href={`/stampa/fattura/${id}`} target="_blank" rel="noopener" className={`${btn} border border-[#e6d7bb] text-[#233c5e]`}>
          <Printer size={16} /> Stampa o salva in PDF
        </a>
        {status === "emessa" && !paying && (
          <button type="button" onClick={() => setPaying(true)} className={`${btn} bg-emerald-600 text-white`}>
            <CheckCircle2 size={16} /> {role === "buyer" ? "Segna come pagata" : "Segna come incassata"}
          </button>
        )}
        {status === "pagata" && (
          <button type="button" disabled={pending} onClick={() => run(() => setInvoicePaid(id, false, null))} className={`${btn} border border-[#e6d7bb] text-slate-700`}>
            Non è ancora pagata
          </button>
        )}
        {role === "seller" && (status === "emessa" || status === "pagata") && !voiding && (
          <button type="button" onClick={() => setVoiding(true)} className={`${btn} text-[#b0413e]`}>
            <RotateCcw size={15} /> Storna (ho fatto una nota di credito)
          </button>
        )}
        <a href={`/api/fatture/export?ruolo=${role}`} className={`${btn} text-slate-600 underline`}>
          <FileSpreadsheet size={15} /> Elenco per il commercialista (CSV)
        </a>
      </div>
      {canXml && role === "seller" && status !== "stornata" && (
        <p className="text-xs text-slate-500">
          Per renderla valida carica il file XML sul portale «Fatture e Corrispettivi» dell&apos;Agenzia delle Entrate (Fatturazione elettronica → Trasmissione → Invia file) o nel programma che usi.
        </p>
      )}
      {paying && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="paid-date">Pagata il</label>
            <DateField id="paid-date" name="paid" value={paidDate} onChange={setPaidDate} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          <button type="button" disabled={pending} onClick={() => run(() => setInvoicePaid(id, true, paidDate))} className={`${btn} bg-emerald-600 text-white`}>Conferma</button>
          <button type="button" onClick={() => setPaying(false)} className={`${btn} text-slate-600`}>Annulla</button>
        </div>
      )}
      {voiding && (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p>Lo storno annulla la fattura qui su Grand Route e rimette i servizi tra quelli da fatturare. Prima emetti la nota di credito nel tuo programma o sul portale dell&apos;Agenzia delle Entrate.</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Es. Nota di credito 3/2026 del 20/11" className="w-full max-w-md rounded-lg border border-red-200 bg-white px-3 py-2" />
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => voidInvoice(id, note))} className={`${btn} bg-[#b0413e] text-white`}>Storna la fattura</button>
            <button type="button" onClick={() => setVoiding(false)} className={`${btn} text-slate-700`}>Annulla</button>
          </div>
        </div>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
