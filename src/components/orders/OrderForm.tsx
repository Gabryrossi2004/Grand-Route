"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import DateField from "@/components/DateField";
import { createOrder, updateOrder, type OrderInput } from "@/lib/actions/orders";
import { CURRENCIES, UNITS, addDays, fmtDate, fmtMoney, todayRome, type OrderPartner } from "@/lib/orders/shared";
import { kindLabel } from "@/lib/network/kinds";
import { parseRequestEmail } from "@/lib/orders/emailParse";
import { Mail } from "lucide-react";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";
const label = "mb-1 block text-sm font-medium text-slate-700";

// Nuovo ordine (o modifica): una sola schermata, con i campi essenziali in alto e le condizioni già proposte.
export default function OrderForm({
  mode,
  role,
  partners = [],
  fixedCounterpart,
  orderId,
  initial,
  buyerServiceId,
  onDone,
}: {
  mode: "create" | "edit";
  role: "buyer" | "seller";
  partners?: OrderPartner[];
  fixedCounterpart?: { id: string; name: string; free_cancel_days?: number; penalty_pct?: number } | null;
  orderId?: string;
  initial?: Partial<OrderInput>;
  buyerServiceId?: string | null;
  onDone: (id?: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [counterpart, setCounterpart] = useState(fixedCounterpart?.id ?? "");
  const partner = partners.find((p) => p.user_id === counterpart);
  const terms = fixedCounterpart ?? partner;
  const [f, setF] = useState<OrderInput>({
    title: initial?.title ?? "",
    details: initial?.details ?? "",
    service_date: initial?.service_date ?? "",
    end_date: initial?.end_date ?? "",
    start_time: initial?.start_time?.slice(0, 5) ?? "",
    place: initial?.place ?? "",
    pax: initial?.pax ?? "",
    reference: initial?.reference ?? "",
    lead_name: initial?.lead_name ?? "",
    quantity: initial?.quantity ?? "1",
    unit: initial?.unit ?? "servizio",
    unit_price: initial?.unit_price ?? "",
    currency: initial?.currency ?? "EUR",
    free_cancel_days: initial?.free_cancel_days ?? String(terms?.free_cancel_days ?? 2),
    penalty_pct: initial?.penalty_pct ?? String(terms?.penalty_pct ?? 100),
  });
  const [multiDay, setMultiDay] = useState(!!initial?.end_date && initial.end_date !== initial.service_date);
  const [more, setMore] = useState(!!(initial?.reference || initial?.lead_name || initial?.details));
  const set = (k: keyof OrderInput) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [parsedInfo, setParsedInfo] = useState<{ found: string[]; warnings: string[] } | null>(null);
  // Compila l'ordine dal testo di un'email di richiesta (senza AI): riempie solo quello che trova
  const fromEmail = () => {
    const r = parseRequestEmail(pasted, todayRome());
    setF((x) => ({
      ...x,
      title: r.title ?? x.title,
      service_date: r.service_date ?? x.service_date,
      start_time: r.start_time ?? x.start_time,
      place: r.place ?? x.place,
      pax: r.pax ?? x.pax,
      lead_name: r.lead_name ?? x.lead_name,
      reference: r.reference ?? x.reference,
      unit_price: r.unit_price ?? x.unit_price,
      details: r.details ?? x.details,
    }));
    if (r.reference || r.lead_name || r.details) setMore(true);
    setParsedInfo({ found: r.found, warnings: r.warnings });
    setPasteOpen(false);
  };

  // Quando si sceglie il partner, si propongono le sue condizioni di cancellazione
  const pick = (id: string) => {
    setCounterpart(id);
    const p = partners.find((x) => x.user_id === id);
    if (p && mode === "create") setF((x) => ({ ...x, free_cancel_days: String(p.free_cancel_days), penalty_pct: String(p.penalty_pct) }));
  };

  const amount = useMemo(() => {
    const q = Number(f.quantity.replace(",", "."));
    const p = Number(f.unit_price.replace(",", "."));
    return q > 0 && p >= 0 ? Math.round(q * p * 100) / 100 : null;
  }, [f.quantity, f.unit_price]);
  const freeUntil = f.service_date ? addDays(f.service_date, -Math.max(0, Number(f.free_cancel_days) || 0)) : null;
  const past = f.service_date && f.service_date < todayRome();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const data = { ...f, end_date: multiDay ? f.end_date : "" };
    start(async () => {
      const r =
        mode === "edit" && orderId
          ? await updateOrder(orderId, data)
          : await createOrder(role, counterpart, data, buyerServiceId ?? null);
      if (!r.ok) return setError(r.error);
      router.refresh();
      onDone("id" in r ? (r.id as string) : orderId);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {mode === "create" && (
        <div className="rounded-xl border border-dashed border-[#c58f2d] bg-[#fffaf0] p-3">
          {!pasteOpen ? (
            <button type="button" onClick={() => setPasteOpen(true)} className="flex items-center gap-2 text-sm font-semibold text-[#8a5a12]">
              <Mail size={16} /> Hai già l&apos;email della richiesta? Incollala e compilo io i campi
            </button>
          ) : (
            <div>
              <label htmlFor="of-paste" className="mb-1 block text-sm font-medium text-slate-700">Incolla qui il testo dell&apos;email (anche con l&apos;oggetto)</label>
              <textarea
                id="of-paste"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={6}
                className={input}
                placeholder={"Oggetto: RICHIESTA SERVIZIO - 19 NOVEMBRE - DELUCA X4\n\nSIG.RI DELUCA (4 PAX)\nPICKUP: ROMA FCO APT, VOLO UA 177 ALLE ORE 11:55\nDROP OFF: HOTEL PALAZZO NAVONA\nTARIFFA: 100€ + IVA"}
              />
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={pasted.trim().length < 10} onClick={fromEmail} className="rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Compila i campi</button>
                <button type="button" onClick={() => setPasteOpen(false)} className="rounded-full px-3 py-2 text-sm text-slate-600">Chiudi</button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Leggo date, orari, persone, percorso (pickup / drop off), tariffa e nome di riferimento. Controlla sempre prima di inviare.</p>
            </div>
          )}
          {parsedInfo && (
            <p className="mt-2 text-xs text-slate-600">
              {parsedInfo.found.length ? `Trovati: ${parsedInfo.found.join(", ")}.` : "Non ho riconosciuto dati: compila a mano."} {parsedInfo.warnings.join(" ")}
            </p>
          )}
        </div>
      )}
      {mode === "create" &&
        (fixedCounterpart ? (
          <p className="rounded-xl bg-[#faf3e6] px-4 py-3 text-sm text-slate-700">
            {role === "buyer" ? "Fornitore" : "Cliente"}: <strong className="text-[#233c5e]">{fixedCounterpart.name}</strong>
          </p>
        ) : (
          <div>
            <label className={label} htmlFor="of-partner">{role === "buyer" ? "A quale fornitore" : "Per quale cliente"} *</label>
            {partners.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Non hai ancora partner: cerca un professionista nella Rete e proponi una collaborazione. Gli ordini si fanno solo tra partner.
              </p>
            ) : (
              <select id="of-partner" value={counterpart} onChange={(e) => pick(e.target.value)} className={input} required>
                <option value="">Scegli…</option>
                {partners.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.name} · {kindLabel(p.kind)}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}

      <div>
        <label className={label} htmlFor="of-title">Servizio *</label>
        <input id="of-title" value={f.title} onChange={(e) => set("title")(e.target.value)} maxLength={200} required placeholder="Es. Transfer aeroporto → hotel, Visita guidata del centro" className={input} />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
        <div>
          <label className={label} htmlFor="of-date">{multiDay ? "Dal" : "Data"} *</label>
          <DateField id="of-date" name="service_date" value={f.service_date} onChange={set("service_date")} className={input} />
        </div>
        {multiDay ? (
          <div>
            <label className={label} htmlFor="of-end">Al</label>
            <DateField id="of-end" name="end_date" value={f.end_date ?? ""} onChange={set("end_date")} className={input} highlightFrom={f.service_date} />
          </div>
        ) : (
          <div className="flex items-end">
            <button type="button" onClick={() => setMultiDay(true)} className="pb-2 text-sm font-medium text-[#233c5e] underline">Dura più giorni</button>
          </div>
        )}
        <div>
          <label className={label} htmlFor="of-time">Ora</label>
          <input id="of-time" type="time" value={f.start_time} onChange={(e) => set("start_time")(e.target.value)} className={input} />
        </div>
      </div>
      {past && mode === "create" && (
        <p className="-mt-2 text-xs text-slate-500">Data già passata: il servizio comparirà subito tra quelli svolti, pronto da fatturare.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div>
          <label className={label} htmlFor="of-place">Luogo / punto d&apos;incontro</label>
          <input id="of-place" value={f.place} onChange={(e) => set("place")(e.target.value)} maxLength={200} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="of-pax">Persone</label>
          <input id="of-pax" type="number" min={1} max={9999} value={f.pax} onChange={(e) => set("pax")(e.target.value)} className={input} />
        </div>
      </div>

      <div className="rounded-xl border border-[#e6d7bb] bg-[#fffaf0] p-4">
        <div className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr_7rem]">
          <div>
            <label className={label} htmlFor="of-qty">Quantità</label>
            <input id="of-qty" inputMode="decimal" value={f.quantity} onChange={(e) => set("quantity")(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="of-unit">Unità</label>
            <input id="of-unit" list="of-units" value={f.unit} onChange={(e) => set("unit")(e.target.value)} maxLength={20} className={input} />
            <datalist id="of-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </div>
          <div>
            <label className={label} htmlFor="of-price">Prezzo per unità, senza IVA *</label>
            <input id="of-price" inputMode="decimal" value={f.unit_price} onChange={(e) => set("unit_price")(e.target.value)} required placeholder="0,00" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="of-cur">Valuta</label>
            <select id="of-cur" value={f.currency} onChange={(e) => set("currency")(e.target.value)} className={input}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-700">
          Totale concordato: <strong className="text-[#233c5e]">{amount != null ? fmtMoney(amount, f.currency) : "—"}</strong>{" "}
          <span className="text-slate-500">+ IVA se dovuta. Extra, attese o spese si aggiungono poi come variazioni.</span>
        </p>
      </div>

      <div className="rounded-xl border border-[#e6d7bb] p-4">
        <p className="text-sm font-medium text-slate-700">Cancellazione</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
          Gratuita fino a
          <input aria-label="Giorni prima" type="number" min={0} max={365} value={f.free_cancel_days} onChange={(e) => set("free_cancel_days")(e.target.value)} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5" />
          giorni prima, poi penale del
          <input aria-label="Penale in percentuale" type="number" min={0} max={100} value={f.penalty_pct} onChange={(e) => set("penalty_pct")(e.target.value)} className="w-20 rounded-lg border border-slate-300 px-2 py-1.5" />%
        </div>
        {freeUntil && (
          <p className="mt-2 text-xs text-slate-500">
            Si annulla gratis fino al <strong>{fmtDate(freeUntil)}</strong> compreso; dopo, chi ha ordinato paga {f.penalty_pct}%
            {amount != null ? ` (${fmtMoney(Math.round(amount * Number(f.penalty_pct || 0)) / 100, f.currency)})` : ""}. Il giorno dopo il servizio l&apos;ordine diventa «svolto» da solo.
          </p>
        )}
      </div>

      {!more ? (
        <button type="button" onClick={() => setMore(true)} className="w-fit text-sm font-medium text-[#233c5e] underline">
          Aggiungi riferimento pratica, nome del cliente o note
        </button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="of-ref">Riferimento (pratica, gruppo)</label>
            <input id="of-ref" value={f.reference} onChange={(e) => set("reference")(e.target.value)} maxLength={200} className={input} placeholder="Es. Pratica 2026/045 – Gruppo Rossi" />
          </div>
          <div>
            <label className={label} htmlFor="of-lead">Nome di riferimento</label>
            <input id="of-lead" value={f.lead_name} onChange={(e) => set("lead_name")(e.target.value)} maxLength={120} className={input} placeholder="Solo se serve (es. capogruppo)" />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="of-details">Note per l&apos;altra parte</label>
            <textarea id="of-details" value={f.details} onChange={(e) => set("details")(e.target.value)} rows={3} maxLength={2000} className={input} placeholder="Orari, esigenze, contatti sul posto…" />
          </div>
        </div>
      )}

      {mode === "edit" && (
        <p className="text-xs text-slate-500">Se cambi data, orario, prezzo o condizioni, l&apos;altra parte dovrà confermare di nuovo. Le sole note no.</p>
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || (mode === "create" && !counterpart)} className="rounded-full bg-[#233c5e] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50">
          {pending ? "Salvataggio…" : mode === "edit" ? "Salva le modifiche" : role === "buyer" ? "Invia l'ordine" : "Registra e manda da confermare"}
        </button>
        <button type="button" onClick={() => onDone()} className="rounded-full px-4 py-2.5 text-sm font-medium text-slate-600">Annulla</button>
      </div>
    </form>
  );
}
