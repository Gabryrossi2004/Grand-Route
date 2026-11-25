"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Plus, Printer, Trash2 } from "lucide-react";
import DateField from "@/components/DateField";
import { deleteInvoiceDraft, saveInvoice } from "@/lib/actions/orders";
import {
  NATURE,
  VAT_RATES,
  bolloRequired,
  checkInvoice,
  computeTotals,
  defaultTax,
  withBolloLine,
  type InvoiceDoc,
  type InvoiceLine,
  type Natura,
} from "@/lib/invoicing/engine";
import { fmtMoney } from "@/lib/orders/shared";

const input = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#cda876]";

// Bozza della fattura: tutto già compilato, si può ritoccare. I conti si rifanno da soli ad ogni modifica.
export default function InvoiceEditor({
  id,
  initialDoc,
  initialNumber,
  initialIssue,
  initialDue,
  currency,
  bolloCharge,
  credit = false,
}: {
  id: string;
  initialDoc: InvoiceDoc;
  initialNumber: string;
  initialIssue: string;
  initialDue: string | null;
  currency: string;
  bolloCharge: boolean;
  credit?: boolean;
}) {
  const what = credit ? "la nota di credito" : "la fattura";
  const router = useRouter();
  const [doc, setDoc] = useState<InvoiceDoc>(initialDoc);
  const [number, setNumber] = useState(initialNumber);
  const [issue, setIssue] = useState(initialIssue);
  const [due, setDue] = useState(initialDue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmEmit, setConfirmEmit] = useState(false);
  const [pending, start] = useTransition();

  const totals = useMemo(() => computeTotals(doc), [doc]);
  const problems = useMemo(() => checkInvoice(doc, { number, issueDate: issue, currency }), [doc, number, issue, currency]);
  const errors = problems.filter((p) => p.level === "errore");
  const warnings = problems.filter((p) => p.level === "avviso");
  const contentLines = doc.lines.filter((l) => l.kind !== "bollo");
  const needBollo = bolloRequired(contentLines);

  const setLines = (lines: InvoiceLine[], bollo = doc.bollo) => setDoc((d) => ({ ...d, lines: withBolloLine(lines, bollo, bolloCharge), bollo }));
  const setLine = (lineId: string, patch: Partial<InvoiceLine>) => setLines(contentLines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  const addLine = () => {
    const tax = defaultTax(doc.regime, "servizio", 22, null);
    setLines([...contentLines, { id: `n${crypto.randomUUID().slice(0, 8)}`, kind: "servizio", description: "", quantity: 1, unit: null, unit_price: 0, ...tax, ritenuta: doc.ritenuta.enabled }]);
  };
  const setTax = (l: InvoiceLine, value: string) => {
    if (value.startsWith("N")) setLine(l.id, { vat_rate: 0, natura: value as Natura });
    else setLine(l.id, { vat_rate: Number(value), natura: Number(value) === 0 ? "N2.1" : null });
  };

  const persist = (emit: boolean) =>
    start(async () => {
      setError(null);
      setSaved(null);
      const r = await saveInvoice(id, doc, { number, issueDate: issue, dueDate: due || null }, emit);
      if (!r.ok) return setError(r.error);
      setConfirmEmit(false);
      if (emit) router.refresh();
      else setSaved("Bozza salvata.");
    });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="inv-number">Numero</label>
          <input id="inv-number" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={20} className={input} />
          <p className="mt-1 text-xs text-slate-500">Deve seguire la tua numerazione (anche delle fatture fatte fuori da qui).</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="inv-date">Data</label>
          <DateField id="inv-date" name="issue" value={issue} onChange={setIssue} className={input} />
        </div>
        <div>
          {!credit && (
            <>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="inv-due">Scadenza del pagamento</label>
              <DateField id="inv-due" name="due" value={due} onChange={setDue} className={input} />
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
        <p className="text-sm font-semibold text-[#233c5e]">Righe {credit ? "della nota di credito" : "della fattura"}</p>
        <div className="mt-3 space-y-3">
          {contentLines.map((l) => (
            <div key={l.id} className="rounded-xl border border-[#f2e2c4] p-3">
              <div className="flex gap-2">
                <textarea value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} rows={2} maxLength={1000} className={input} aria-label="Descrizione" />
                <button type="button" onClick={() => setLines(contentLines.filter((x) => x.id !== l.id))} className="self-start rounded-md p-2 text-slate-400 hover:text-red-600" aria-label="Togli la riga"><Trash2 size={16} /></button>
              </div>
              <div className="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-[5rem_7rem_1fr_auto_7rem]">
                <label className="text-[11px] font-medium text-slate-500">
                  Quantità
                  <input value={l.quantity} onChange={(e) => setLine(l.id, { quantity: Number(e.target.value.replace(",", ".")) || 0 })} inputMode="decimal" className={input} />
                </label>
                <label className="text-[11px] font-medium text-slate-500">
                  Prezzo senza IVA
                  <input value={l.unit_price} onChange={(e) => setLine(l.id, { unit_price: Number(e.target.value.replace(",", ".")) || 0 })} inputMode="decimal" className={input} />
                </label>
                <label className="col-span-2 text-[11px] font-medium text-slate-500 sm:col-span-1">
                  IVA
                  <select value={l.vat_rate > 0 ? String(l.vat_rate) : (l.natura ?? "N1")} onChange={(e) => setTax(l, e.target.value)} className={input}>
                    {VAT_RATES.filter((r) => r > 0).map((r) => <option key={r} value={r}>IVA {r}%</option>)}
                    {(Object.keys(NATURE) as Natura[]).map((n) => <option key={n} value={n}>Senza IVA – {NATURE[n].label}</option>)}
                  </select>
                </label>
                {doc.ritenuta.enabled && l.kind === "servizio" ? (
                  <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-600">
                    <input type="checkbox" checked={l.ritenuta} onChange={(e) => setLine(l.id, { ritenuta: e.target.checked })} /> ritenuta
                  </label>
                ) : <span />}
                <p className="pb-2 text-right text-sm font-semibold">{fmtMoney(totals.lineTotals[l.id] ?? 0, currency)}</p>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addLine} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#233c5e] underline"><Plus size={14} /> Aggiungi una riga</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_18rem]">
        <div className="space-y-3 rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={doc.bollo} onChange={(e) => setLines(contentLines, e.target.checked)} className="mt-0.5" />
            <span>
              Marca da bollo virtuale da 2 €{bolloCharge ? " (addebitata al cliente)" : ""}
              <span className="block text-xs text-slate-500">{needBollo ? "Serve: gli importi senza IVA superano 77,47 €." : "Non serve: gli importi senza IVA non superano 77,47 €."}</span>
            </span>
          </label>
          {doc.regime === "RF01" && (
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={doc.ritenuta.enabled} onChange={(e) => setDoc((d) => ({ ...d, ritenuta: { ...d.ritenuta, enabled: e.target.checked } }))} />
              Ritenuta d&apos;acconto del
              <input value={doc.ritenuta.rate} onChange={(e) => setDoc((d) => ({ ...d, ritenuta: { ...d.ritenuta, rate: Number(e.target.value) || 0 } }))} className="w-16 rounded-lg border border-slate-300 px-2 py-1" aria-label="Percentuale ritenuta" />%
            </label>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="inv-sdi">Codice SDI del cliente</label>
              <input id="inv-sdi" value={doc.buyer.sdi_code ?? ""} onChange={(e) => setDoc((d) => ({ ...d, buyer: { ...d.buyer, sdi_code: e.target.value.toUpperCase() } }))} maxLength={7} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="inv-pec">PEC del cliente</label>
              <input id="inv-pec" value={doc.buyer.pec ?? ""} onChange={(e) => setDoc((d) => ({ ...d, buyer: { ...d.buyer, pec: e.target.value } }))} className={input} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="inv-iban">IBAN per il pagamento</label>
            <input id="inv-iban" value={doc.payment.iban ?? ""} onChange={(e) => setDoc((d) => ({ ...d, payment: { ...d.payment, iban: e.target.value } }))} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="inv-notes">Note in fattura</label>
            <textarea id="inv-notes" value={doc.notes ?? ""} onChange={(e) => setDoc((d) => ({ ...d, notes: e.target.value }))} rows={3} maxLength={1200} className={input} />
          </div>
        </div>
        <div className="h-fit rounded-2xl bg-[#faf3e6] p-4 text-sm">
          <p className="flex justify-between"><span>Imponibile</span><span>{fmtMoney(totals.imponibile, currency)}</span></p>
          <p className="flex justify-between"><span>IVA</span><span>{fmtMoney(totals.iva, currency)}</span></p>
          <p className="mt-1 flex justify-between border-t border-[#e6d7bb] pt-1 font-semibold"><span>Totale</span><span>{fmtMoney(totals.totale, currency)}</span></p>
          {totals.ritenuta > 0 && <p className="flex justify-between text-slate-600"><span>Ritenuta</span><span>− {fmtMoney(totals.ritenuta, currency)}</span></p>}
          <p className="mt-1 flex justify-between border-t border-[#e6d7bb] pt-1 text-base font-semibold text-[#233c5e]"><span>Da pagare</span><span>{fmtMoney(totals.netto, currency)}</span></p>
        </div>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          {errors.map((p) => <p key={p.text} className="flex gap-2 text-red-700"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {p.text}</p>)}
          {warnings.map((p) => <p key={p.text} className="flex gap-2 text-amber-800"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {p.text}</p>)}
          {errors.some((p) => p.text.includes("profilo")) && <Link href="/rete/profilo" className="inline-block font-medium text-[#233c5e] underline">Apri il profilo</Link>}
          {errors.some((p) => p.text.includes("impostazioni")) && <Link href="/rete/fatture/impostazioni" className="ml-3 inline-block font-medium text-[#233c5e] underline">Apri le impostazioni di fatturazione</Link>}
        </div>
      )}
      {errors.length === 0 && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> Tutto a posto per emettere {what}.</p>}

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{saved}</p>}

      {confirmEmit ? (
        <div className="rounded-2xl border border-[#233c5e] bg-white p-4 text-sm text-slate-700">
          <p className="font-semibold text-[#233c5e]">Emettere {what} {number}?</p>
          <p className="mt-1">
            Dopo non si può più modificare (per correggerla serve una nota di credito). Il cliente la vede subito su Grand Route con il dettaglio dei servizi.
            Poi <strong>scarica il file XML e caricalo</strong> sul portale «Fatture e Corrispettivi» dell&apos;Agenzia delle Entrate o nel tuo programma di fatturazione: la fattura è valida solo dopo l&apos;invio allo SDI.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={pending} onClick={() => persist(true)} className="rounded-full bg-[#233c5e] px-5 py-2 font-semibold text-white disabled:opacity-50">{pending ? "Emissione…" : "Sì, emetti"}</button>
            <button type="button" onClick={() => setConfirmEmit(false)} className="rounded-full px-4 py-2 font-medium text-slate-600">Indietro</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending || errors.length > 0} onClick={() => setConfirmEmit(true)} className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{credit ? "Emetti la nota di credito" : "Emetti la fattura"}</button>
          <button type="button" disabled={pending} onClick={() => persist(false)} className="rounded-full border border-[#233c5e] px-5 py-2.5 text-sm font-semibold text-[#233c5e] disabled:opacity-50">Salva la bozza</button>
          <a href={`/stampa/fattura/${id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 underline"><Printer size={15} /> Anteprima di stampa (dell&apos;ultima versione salvata)</a>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteInvoiceDraft(id);
                if (!r.ok) return setError(r.error);
                router.push("/rete/lavori");
              })
            }
            className="rounded-full px-4 py-2.5 text-sm font-medium text-[#b0413e]"
          >
            {credit ? "Elimina la bozza" : "Elimina la bozza (i servizi tornano da fatturare)"}
          </button>
        </div>
      )}
    </div>
  );
}
