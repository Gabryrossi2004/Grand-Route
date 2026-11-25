"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBillingSettings } from "@/lib/actions/orders";
import { formatInvoiceNumber, isValidIban, NATURE, type Natura } from "@/lib/invoicing/engine";
import type { BillingSettings } from "@/lib/invoicing/draft";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";
const label = "mb-1 block text-sm font-medium text-slate-700";
const box = "rounded-2xl border border-[#e6d7bb] bg-white p-5";

// Impostazioni della fattura del fornitore: si fanno una volta, poi ogni bozza si compila da sola.
export default function BillingSettingsForm({ initial, legalForm }: { initial: BillingSettings; legalForm: string | null }) {
  const router = useRouter();
  const [s, setS] = useState<BillingSettings>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof BillingSettings>(k: K, v: BillingSettings[K]) => {
    setSaved(false);
    setS((x) => ({ ...x, [k]: v }));
  };
  const ordinario = s.regime === "RF01";
  const ibanOk = !s.iban || isValidIban(s.iban);
  const personHint = legalForm && /individuale|professionista/i.test(legalForm);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await saveBillingSettings(s);
          if (!r.ok) return setError(r.error);
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <div className={box}>
        <p className="text-base font-semibold text-[#233c5e]">Chi emette la fattura</p>
        <p className="mt-1 text-sm text-slate-600">Partita IVA, indirizzo e codice fiscale arrivano dal tuo profilo della Rete.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            [false, "Società o ditta (denominazione)"],
            [true, "Persona fisica (nome e cognome)"],
          ].map(([v, l]) => (
            <button key={String(v)} type="button" onClick={() => set("person", v as boolean)} aria-pressed={s.person === v} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${s.person === v ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] text-[#233c5e]"}`}>
              {l as string}
            </button>
          ))}
        </div>
        {personHint && !s.person && <p className="mt-2 text-xs text-amber-700">Nel profilo sei «{legalForm}»: di solito in fattura vanno nome e cognome.</p>}
        {s.person && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className={label} htmlFor="bs-fn">Nome</label><input id="bs-fn" value={s.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} className={input} /></div>
            <div><label className={label} htmlFor="bs-ln">Cognome</label><input id="bs-ln" value={s.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} className={input} /></div>
          </div>
        )}
      </div>

      <div className={box}>
        <p className="text-base font-semibold text-[#233c5e]">Regime fiscale e IVA</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="bs-reg">Regime</label>
            <select id="bs-reg" value={s.regime} onChange={(e) => set("regime", e.target.value as BillingSettings["regime"])} className={input}>
              <option value="RF01">Ordinario (con IVA)</option>
              <option value="RF19">Forfettario (senza IVA)</option>
              <option value="RF02">Contribuenti minimi</option>
            </select>
          </div>
          {ordinario && (
            <div>
              <label className={label} htmlFor="bs-vat">IVA di solito applicata</label>
              <select id="bs-vat" value={s.default_vat === 0 ? (s.default_natura ?? "N2.1") : String(s.default_vat)} onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("N")) { set("default_vat", 0); set("default_natura", v as Natura); } else { set("default_vat", Number(v)); set("default_natura", null); }
              }} className={input}>
                <option value="22">22% (guide, accompagnatori, esperienze)</option>
                <option value="10">10% (trasporto persone, alloggi)</option>
                <option value="5">5%</option>
                <option value="4">4%</option>
                {(["N2.1", "N4"] as Natura[]).map((n) => <option key={n} value={n}>Senza IVA – {NATURE[n].label}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">Si può cambiare riga per riga in ogni fattura.</p>
            </div>
          )}
        </div>
        {!ordinario && <p className="mt-3 text-sm text-slate-600">In fattura non c&apos;è IVA (natura N2.2), si aggiunge in automatico la dicitura del regime e la marca da bollo sopra 77,47 €.</p>}
        {ordinario && (
          <label className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={s.ritenuta} onChange={(e) => set("ritenuta", e.target.checked)} />
            Applico la ritenuta d&apos;acconto del
            <input type="number" min={1} max={50} value={s.ritenuta_rate} onChange={(e) => set("ritenuta_rate", Number(e.target.value))} className="w-16 rounded-lg border border-slate-300 px-2 py-1" aria-label="Percentuale" />%
            <select value={s.ritenuta_type} onChange={(e) => set("ritenuta_type", e.target.value as "RT01" | "RT02")} className="rounded-lg border border-slate-300 px-2 py-1" aria-label="Tipo">
              <option value="RT01">persona fisica</option>
              <option value="RT02">persona giuridica</option>
            </select>
            <span className="w-full text-xs text-slate-500">Di solito la applicano i professionisti (es. guide con partita IVA) che fatturano ad agenzie e aziende. Chiedi al tuo commercialista.</span>
          </label>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={s.bollo_charge} onChange={(e) => set("bollo_charge", e.target.checked)} />
          Quando serve la marca da bollo (2 €), la addebito al cliente
        </label>
      </div>

      <div className={box}>
        <p className="text-base font-semibold text-[#233c5e]">Pagamento e numerazione</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="bs-iban">IBAN</label>
            <input id="bs-iban" value={s.iban ?? ""} onChange={(e) => set("iban", e.target.value.toUpperCase())} className={input} placeholder="IT60 X054 2811 1010 0000 0123 456" />
            {!ibanOk && <p className="mt-1 text-xs text-red-600">L&apos;IBAN non sembra corretto.</p>}
          </div>
          <div><label className={label} htmlFor="bs-bank">Banca (facoltativo)</label><input id="bs-bank" value={s.bank ?? ""} onChange={(e) => set("bank", e.target.value)} className={input} /></div>
          <div>
            <label className={label} htmlFor="bs-days">Giorni per pagare</label>
            <select id="bs-days" value={s.payment_days} onChange={(e) => set("payment_days", Number(e.target.value))} className={input}>
              {[0, 7, 15, 30, 60, 90].map((d) => <option key={d} value={d}>{d === 0 ? "A vista" : `${d} giorni`}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="bs-next">Prossimo numero di fattura</label>
            <div className="flex gap-2">
              <input id="bs-next" type="number" min={1} value={s.next_number} onChange={(e) => set("next_number", Number(e.target.value))} className={`${input} w-24`} />
              <input value={s.number_pattern} onChange={(e) => set("number_pattern", e.target.value)} className={input} aria-label="Formato del numero" />
            </div>
            <p className="mt-1 text-xs text-slate-500">Anteprima: <strong>{formatInvoiceNumber(s.number_pattern, s.next_number || 1, new Date().getFullYear())}</strong>. Usa {"{n}"} per il numero e {"{anno}"} per l&apos;anno.</p>
          </div>
        </div>
        <div className="mt-3">
          <label className={label} htmlFor="bs-notes">Nota fissa in fattura (facoltativa)</label>
          <textarea id="bs-notes" value={s.invoice_notes ?? ""} onChange={(e) => set("invoice_notes", e.target.value)} rows={2} maxLength={400} className={input} placeholder="Es. Iscrizione albo guide n. …" />
        </div>
      </div>

      <div className={box}>
        <p className="text-base font-semibold text-[#233c5e]">Le tue condizioni di cancellazione</p>
        <p className="mt-1 text-sm text-slate-600">Vengono proposte in ogni nuovo ordine (si possono cambiare ordine per ordine).</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
          Gratuita fino a
          <input type="number" min={0} max={365} value={s.free_cancel_days} onChange={(e) => set("free_cancel_days", Number(e.target.value))} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5" aria-label="Giorni" />
          giorni prima, poi penale del
          <input type="number" min={0} max={100} value={s.penalty_pct} onChange={(e) => set("penalty_pct", Number(e.target.value))} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5" aria-label="Penale" />%
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Salvato. Le prossime fatture useranno queste impostazioni.</p>}
      <button type="submit" disabled={pending || !ibanOk} className="w-fit rounded-full bg-[#233c5e] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50">
        {pending ? "Salvataggio…" : "Salva le impostazioni"}
      </button>
      <p className="text-xs text-slate-500">Grand Route prepara le fatture con i tuoi dati ma non è un consulente fiscale: per regime, aliquote e ritenuta fai riferimento al tuo commercialista.</p>
    </form>
  );
}
