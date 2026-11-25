"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Download, FileMinus, FileSpreadsheet, Printer, RotateCcw } from "lucide-react";
import DateField from "@/components/DateField";
import { createCreditNote, sendReminder, setInvoicePaid, voidInvoice } from "@/lib/actions/orders";
import { todayRome } from "@/lib/orders/shared";

const btn = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50";

// Azioni su un documento emesso: XML, stampa, pagata, sollecito, nota di credito
export default function InvoiceActions({
  id,
  role,
  status,
  canXml,
  docType = "TD01",
  overdue = false,
  remindersSent = 0,
  hasFullCredit = false,
}: {
  id: string;
  role: "seller" | "buyer";
  status: string;
  canXml: boolean;
  docType?: string;
  overdue?: boolean;
  remindersSent?: number;
  hasFullCredit?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paidDate, setPaidDate] = useState(todayRome());
  const [crediting, setCrediting] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [note, setNote] = useState("");
  const invoice = docType === "TD01";
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      setError(null);
      setInfo(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Errore");
      else {
        setPaying(false);
        setVoiding(false);
        if (done) setInfo(done);
        router.refresh();
      }
    });
  const credit = (full: boolean) =>
    start(async () => {
      setError(null);
      const r = await createCreditNote(id, full);
      if (!r.ok) return setError(r.error);
      router.push(`/rete/fatture/${r.id}`);
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canXml && (
          <a href={`/api/fatture/${id}/xml`} className={`${btn} bg-[#233c5e] text-white`}>
            <Download size={16} /> Scarica l&apos;XML ({invoice ? "fattura" : "nota di credito"} elettronica)
          </a>
        )}
        <a href={`/stampa/fattura/${id}`} target="_blank" rel="noopener" className={`${btn} border border-[#e6d7bb] text-[#233c5e]`}>
          <Printer size={16} /> Stampa o salva in PDF
        </a>
        {invoice && status === "emessa" && !paying && (
          <button type="button" onClick={() => setPaying(true)} className={`${btn} bg-emerald-600 text-white`}>
            <CheckCircle2 size={16} /> {role === "buyer" ? "Segna come pagata" : "Segna come incassata"}
          </button>
        )}
        {invoice && status === "pagata" && (
          <button type="button" disabled={pending} onClick={() => run(() => setInvoicePaid(id, false, null))} className={`${btn} border border-[#e6d7bb] text-slate-700`}>
            Non è ancora pagata
          </button>
        )}
        {invoice && role === "seller" && status === "emessa" && (
          <button type="button" disabled={pending} onClick={() => run(() => sendReminder(id), "Sollecito inviato al cliente (email e notifica).")} className={`${btn} border ${overdue ? "border-[#c0392b] text-[#c0392b]" : "border-[#e6d7bb] text-slate-700"}`}>
            <BellRing size={15} /> Manda un sollecito ora
          </button>
        )}
        {invoice && role === "seller" && (status === "emessa" || status === "pagata") && !hasFullCredit && !crediting && (
          <button type="button" onClick={() => setCrediting(true)} className={`${btn} border border-[#e6d7bb] text-[#233c5e]`}>
            <FileMinus size={15} /> Nota di credito
          </button>
        )}
        <a href={`/api/fatture/export?ruolo=${role}`} className={`${btn} text-slate-600 underline`}>
          <FileSpreadsheet size={15} /> Elenco per il commercialista (CSV)
        </a>
      </div>
      {invoice && role === "seller" && status === "emessa" && (
        <p className="text-xs text-slate-500">
          {remindersSent > 0 ? `Solleciti già inviati: ${remindersSent}. ` : ""}Se la fattura scade, i solleciti partono da soli (1, 7, 15 e 30 giorni dopo), a meno che tu non li abbia spenti nelle impostazioni.
        </p>
      )}
      {canXml && role === "seller" && status !== "stornata" && (
        <p className="text-xs text-slate-500">
          Per renderla valida carica il file XML sul portale «Fatture e Corrispettivi» dell&apos;Agenzia delle Entrate (Fatturazione elettronica → Trasmissione → Invia file) o nel programma che usi.
        </p>
      )}
      {crediting && (
        <div className="space-y-3 rounded-xl border border-[#e6d7bb] bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold text-[#233c5e]">Che nota di credito ti serve?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={pending} onClick={() => credit(true)} className="rounded-xl border border-[#e6d7bb] p-3 text-left hover:border-[#c58f2d]">
              <span className="block font-semibold text-slate-900">Totale</span>
              <span className="block text-xs text-slate-600">Annulla tutta la fattura (es. fattura sbagliata). Quando la emetti, la fattura risulta stornata e i servizi tornano da fatturare.</span>
            </button>
            <button type="button" disabled={pending} onClick={() => credit(false)} className="rounded-xl border border-[#e6d7bb] p-3 text-left hover:border-[#c58f2d]">
              <span className="block font-semibold text-slate-900">Parziale</span>
              <span className="block text-xs text-slate-600">Corregge solo una parte (es. un prezzo da 130 a 80 €): scrivi la differenza. La fattura resta, il cliente paga il resto.</span>
            </button>
          </div>
          <button type="button" onClick={() => setCrediting(false)} className="text-sm text-slate-500 underline">Annulla</button>
          {!voiding && (
            <p className="text-xs text-slate-500">
              Hai già fatto la nota di credito fuori da Grand Route?{" "}
              <button type="button" onClick={() => setVoiding(true)} className="underline">Storna solo qui</button>
            </p>
          )}
        </div>
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
          <p>Lo storno annulla la fattura qui su Grand Route e rimette i servizi tra quelli da fatturare. Usalo solo se la nota di credito l&apos;hai già emessa fuori da qui.</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Es. Nota di credito 3/2026 del 20/11" className="w-full max-w-md rounded-lg border border-red-200 bg-white px-3 py-2" />
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => voidInvoice(id, note))} className={`${btn} bg-[#b0413e] text-white`}><RotateCcw size={15} /> Storna la fattura</button>
            <button type="button" onClick={() => setVoiding(false)} className={`${btn} text-slate-700`}>Annulla</button>
          </div>
        </div>
      )}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {info && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
    </div>
  );
}
