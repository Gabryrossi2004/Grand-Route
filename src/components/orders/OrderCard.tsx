"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Check, ChevronDown, Clock, FileText, MapPin, Paperclip, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";
import OrderForm from "@/components/orders/OrderForm";
import {
  addExtra,
  cancelOrder,
  confirmOrder,
  declineOrder,
  decideExtra,
  deleteExtra,
  receiptUrl,
  setPenalty,
  syncServiceCost,
  updateExtra,
} from "@/lib/actions/orders";
import {
  PHASES,
  baseAmount,
  billableBlock,
  extraDeadline,
  fmtDate,
  fmtDay,
  fmtMoney,
  orderTotal,
  todayRome,
  waitingForMe,
  type OrderExtra,
  type OrderRow,
} from "@/lib/orders/shared";
import { kindLabel } from "@/lib/network/kinds";

const btn = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";
const MAX_RECEIPT = 10 * 1024 * 1024;
const RECEIPT_TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

type Result = { ok: true } | { ok: false; error: string };

function ExtraForm({ order, extra, onDone }: { order: OrderRow; extra?: OrderExtra; onDone: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<"servizio" | "spesa">(extra?.kind ?? "servizio");
  const [desc, setDesc] = useState(extra?.description ?? "");
  const [qty, setQty] = useState(String(extra?.quantity ?? 1));
  const [price, setPrice] = useState(extra ? String(extra.unit_price) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const q = Number(qty.replace(",", "."));
  const p = Number(price.replace(",", "."));
  const total = q > 0 && Number.isFinite(p) ? Math.round(q * p * 100) / 100 : null;
  const iAmBuyer = order.role === "buyer";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      let path: string | null = null;
      const f = file.current?.files?.[0];
      if (f && !extra) {
        const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
        if (!RECEIPT_TYPES[ext]) return setError("La ricevuta deve essere una foto o un PDF.");
        if (f.size > MAX_RECEIPT) return setError("La ricevuta supera i 10 MB.");
        path = `${order.id}/${crypto.randomUUID()}.${ext}`;
        const up = await createClient().storage.from("network-orders").upload(path, f, { contentType: RECEIPT_TYPES[ext], upsert: false });
        if (up.error) return setError("Non sono riuscito a caricare la ricevuta. Riprova.");
      }
      const r = extra ? await updateExtra(extra.id, kind, desc, q, p) : await addExtra(order.id, kind, desc, q, p, path);
      if (!r.ok) return setError(r.error);
      router.refresh();
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-[#e6d7bb] bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["servizio", "Extra o sconto sul servizio", "Es. ore di attesa, km in più, persona in più. Per uno sconto metti un importo negativo."],
            ["spesa", "Spesa anticipata per il cliente", "Es. biglietti d'ingresso, pedaggi, parcheggi: in fattura senza IVA (art. 15)."],
          ] as const
        ).map(([k, l, h]) => (
          <button key={k} type="button" onClick={() => setKind(k)} title={h} aria-pressed={kind === k} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${kind === k ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] text-[#233c5e]"}`}>
            {l}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{kind === "servizio" ? "Ore di attesa, km in più, una persona in più… Per uno sconto scrivi un importo negativo." : "Biglietti d'ingresso, pedaggi, parcheggi pagati per conto del cliente: in fattura vanno senza IVA."}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_5rem_8rem]">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} required placeholder="Descrizione" className={input} aria-label="Descrizione" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={input} aria-label="Quantità" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required placeholder="Importo" className={input} aria-label="Importo per unità" />
      </div>
      {!extra && (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <Paperclip size={14} /> Ricevuta (facoltativa, foto o PDF):
          <input ref={file} type="file" accept=".pdf,image/*" className="text-xs" />
        </label>
      )}
      <p className="mt-2 text-sm text-slate-700">
        Totale variazione: <strong>{total != null ? fmtMoney(total, order.currency) : "—"}</strong>
        {!iAmBuyer && total != null && total > 0 && <span className="text-slate-500"> · il cliente ha 3 giorni per contestarla, poi vale come accettata</span>}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={pending} className={`${btn} bg-[#233c5e] text-white`}>{pending ? "Salvataggio…" : extra ? "Salva" : "Aggiungi la variazione"}</button>
        <button type="button" onClick={onDone} className={`${btn} text-slate-600`}>Annulla</button>
      </div>
    </form>
  );
}

function ExtraRow({ order, e, me, run, pending }: { order: OrderRow; e: OrderExtra; me: string; run: (fn: () => Promise<Result>) => void; pending: boolean }) {
  const [editing, setEditing] = useState(false);
  const [contesting, setContesting] = useState(false);
  const [note, setNote] = useState("");
  const mine = e.created_by === me;
  const total = Math.round(e.quantity * e.unit_price * 100) / 100;
  const deadline = extraDeadline(e);
  const canDecide = order.role === "buyer" && !mine && e.state === "proposta" && !order.invoice_id;
  const canEdit = mine && !order.invoice_id && (e.state !== "accettata" || order.role === "buyer");
  if (editing) return <ExtraForm order={order} extra={e} onDone={() => setEditing(false)} />;
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-800">
            {e.description}{" "}
            <span className="text-xs text-slate-500">
              · {e.kind === "spesa" ? "spesa anticipata" : total < 0 ? "sconto" : "extra"} · {e.quantity} × {fmtMoney(e.unit_price, order.currency)}
            </span>
          </p>
          <p className="mt-0.5 text-xs">
            {e.state === "accettata" && <span className="font-medium text-emerald-700">Accettata</span>}
            {e.state === "proposta" && (
              <span className="font-medium text-amber-700">
                In attesa: {order.role === "buyer" ? "puoi contestarla" : "il cliente può contestarla"} fino al {deadline.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}, poi vale come accettata
              </span>
            )}
            {e.state === "contestata" && (
              <span className="font-medium text-red-700">Contestata{e.contest_note ? `: «${e.contest_note}»` : ""}{order.role === "seller" ? " — modificala o toglila" : ""}</span>
            )}
            {e.receipt_path && (
              <button type="button" onClick={async () => { const r = await receiptUrl(e.receipt_path!); if (r.ok) window.open(r.url, "_blank", "noopener"); }} className="ml-2 inline-flex items-center gap-1 text-[#233c5e] underline">
                <Paperclip size={12} /> ricevuta
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-sm font-semibold ${total < 0 ? "text-emerald-700" : "text-slate-800"}`}>{fmtMoney(total, order.currency)}</span>
          {canEdit && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="rounded-md p-1.5 text-slate-400 hover:text-[#233c5e]" aria-label="Modifica la variazione"><Pencil size={14} /></button>
              <button type="button" disabled={pending} onClick={() => run(() => deleteExtra(e.id))} className="rounded-md p-1.5 text-slate-400 hover:text-red-600" aria-label="Togli la variazione"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>
      {canDecide && !contesting && (
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={pending} onClick={() => run(() => decideExtra(e.id, order.id, true, ""))} className={`${btn} bg-emerald-600 py-1.5 text-white`}><Check size={14} /> Accetta</button>
          <button type="button" disabled={pending} onClick={() => setContesting(true)} className={`${btn} border border-[#e6d7bb] py-1.5 text-slate-700`}>Contesta</button>
        </div>
      )}
      {contesting && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={300} placeholder="Perché? (il fornitore lo legge)" className={`${input} max-w-sm`} />
          <button type="button" disabled={pending} onClick={() => run(() => decideExtra(e.id, order.id, false, note))} className={`${btn} bg-[#b0413e] py-1.5 text-white`}>Invia la contestazione</button>
          <button type="button" onClick={() => setContesting(false)} className={`${btn} py-1.5 text-slate-600`}>Annulla</button>
        </div>
      )}
    </li>
  );
}

export default function OrderCard({ order, me, invoiceBase, defaultOpen = false }: { order: OrderRow; me: string; invoiceBase: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [addingExtra, setAddingExtra] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelAsk, setCancelAsk] = useState(false);
  const [penaltyEdit, setPenaltyEdit] = useState<string | null>(null);

  const run = (fn: () => Promise<Result>, done?: string) =>
    start(async () => {
      setError(null);
      setInfo(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else {
        if (done) setInfo(done);
        router.refresh();
      }
    });

  const o = order;
  const today = todayRome();
  const phase = PHASES[o.phase];
  const total = orderTotal(o);
  const pendingExtras = o.extras.filter((e) => e.state === "proposta").reduce((s, e) => s + e.quantity * e.unit_price, 0);
  const waiting = waitingForMe(o, me);
  const waitingOther = o.status === "richiesto" && o.phase === "da_confermare" && o.last_edit_by === me;
  const open_ = o.status === "richiesto" || o.status === "confermato";
  const beforeService = today <= o.service_date;
  const canEdit = open_ && !o.invoice_id && beforeService;
  const canCancel = open_ && !o.invoice_id && beforeService;
  const willPay = o.role === "buyer" && o.status === "confermato" && today > o.free_until;
  const penaltyPreview = Math.round(baseAmount(o) * o.penalty_pct) / 100;
  const block = o.role === "seller" ? billableBlock(o) : null;
  const neverConfirmed = o.phase === "svolto" && !o.confirmed_at;

  return (
    <article className={`rounded-2xl border bg-white shadow-sm ${waiting ? "border-[#c58f2d]" : "border-[#e6d7bb]"}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={open}>
        <div className="w-14 shrink-0 rounded-xl bg-[#faf3e6] py-1.5 text-center">
          <p className="text-[11px] font-semibold uppercase text-[#a08a5e]">{new Date(`${o.service_date}T12:00:00Z`).toLocaleDateString("it-IT", { month: "short", timeZone: "UTC" })}</p>
          <p className="text-xl font-semibold leading-none text-[#233c5e]">{Number(o.service_date.slice(8, 10))}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${phase.tone}`}>{waiting ? "Tocca a te confermare" : phase.label}</span>
            {o.invoice_number && <span className="text-xs text-slate-500">Fattura {o.invoice_number}</span>}
            {neverConfirmed && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">mai confermato</span>}
          </div>
          <p className="mt-1 line-clamp-2 text-base font-semibold text-slate-900">{o.title}</p>
          <p className="truncate text-sm text-slate-500">
            {o.role === "seller" ? "Per " : "Da "}
            {o.counterpart_name} · {kindLabel(o.counterpart_kind)}
            {o.start_time ? ` · ore ${o.start_time.slice(0, 5)}` : ""}
            {o.end_date && o.end_date !== o.service_date ? ` · fino al ${fmtDate(o.end_date, { day: "numeric", month: "short" })}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-[#233c5e]">{fmtMoney(total, o.currency)}</p>
          {pendingExtras !== 0 && <p className="text-xs text-amber-700">+{fmtMoney(pendingExtras, o.currency)} in attesa</p>}
          <ChevronDown size={16} className={`ml-auto mt-1 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-[#f2e2c4] px-4 pb-4 pt-3">
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p className="flex items-center gap-2"><CalendarClock size={15} className="text-[#c58f2d]" /> {fmtDay(o.service_date)}{o.end_date && o.end_date !== o.service_date ? ` → ${fmtDay(o.end_date)}` : ""}{o.start_time ? `, ore ${o.start_time.slice(0, 5)}` : ""}</p>
            {o.place && <p className="flex items-center gap-2"><MapPin size={15} className="text-[#c58f2d]" /> {o.place}</p>}
            {o.pax && <p className="flex items-center gap-2"><Users size={15} className="text-[#c58f2d]" /> {o.pax} persone{o.lead_name ? ` · rif. ${o.lead_name}` : ""}</p>}
            {o.reference && <p className="flex items-center gap-2"><FileText size={15} className="text-[#c58f2d]" /> {o.reference}</p>}
            <p className="flex items-center gap-2"><Clock size={15} className="text-[#c58f2d]" /> {o.quantity} {o.unit} × {fmtMoney(o.unit_price, o.currency)} = {fmtMoney(baseAmount(o), o.currency)} <span className="text-slate-400">+ IVA se dovuta</span></p>
            {open_ && beforeService && (
              <p className="text-xs text-slate-500 sm:col-span-2">
                Cancellazione gratuita fino al {fmtDate(o.free_until)} compreso, poi penale del {o.penalty_pct}% ({fmtMoney(penaltyPreview, o.currency)}).
              </p>
            )}
            {o.trip_id && (
              <p className="text-sm sm:col-span-2">
                Viaggio: <Link href={`/dashboard/trips/${o.trip_id}`} className="font-medium text-[#233c5e] underline">{o.trip_title}</Link>
                {o.service_net_cost != null && <span className="text-slate-500"> · costo nel viaggio {fmtMoney(o.service_net_cost)}</span>}
              </p>
            )}
          </div>
          {o.details && <p className="mt-3 whitespace-pre-line rounded-xl bg-[#faf3e6] p-3 text-sm text-slate-700">{o.details}</p>}
          {o.status === "rifiutato" && <p className="mt-3 text-sm text-slate-600">Rifiutato{o.decline_reason ? `: «${o.decline_reason}»` : "."}</p>}
          {o.phase === "penale" && (
            <div className="mt-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-900">
              Annullato il {fmtDate(o.cancelled_at)} oltre la data limite: penale di <strong>{fmtMoney(o.penalty_amount ?? 0, o.currency)}</strong>.
              {o.role === "seller" && !o.invoice_id && (
                penaltyEdit === null ? (
                  <button type="button" onClick={() => setPenaltyEdit(String(o.penalty_amount ?? 0))} className="ml-2 font-medium underline">Riduci o togli la penale</button>
                ) : (
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <input value={penaltyEdit} onChange={(e) => setPenaltyEdit(e.target.value)} inputMode="decimal" className="w-28 rounded-lg border border-orange-200 px-2 py-1" aria-label="Nuova penale" />
                    <button type="button" disabled={pending} onClick={() => run(() => setPenalty(o.id, Number(penaltyEdit.replace(",", "."))), "Penale aggiornata.")} className={`${btn} bg-orange-600 py-1.5 text-white`}>Salva</button>
                    <button type="button" onClick={() => setPenaltyEdit(null)} className="text-sm underline">Annulla</button>
                  </span>
                )
              )}
            </div>
          )}
          {o.phase === "annullato" && <p className="mt-3 text-sm text-slate-600">Annullato senza penale il {fmtDate(o.cancelled_at)}.</p>}
          {neverConfirmed && (
            <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> L&apos;ordine non è mai stato confermato da {o.last_edit_by === me ? o.counterpart_name : "te"}. Si considera comunque svolto: se c&apos;è un problema, sentitevi prima della fattura.
            </p>
          )}

          {/* Variazioni */}
          {(o.extras.length > 0 || (open_ && !o.invoice_id)) && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Variazioni di prezzo</p>
              {o.extras.length > 0 && (
                <ul className="divide-y divide-[#f2e2c4]">
                  {o.extras.map((e) => (
                    <ExtraRow key={e.id} order={o} e={e} me={me} run={run} pending={pending} />
                  ))}
                </ul>
              )}
              {open_ && !o.invoice_id && (addingExtra ? (
                <ExtraForm order={o} onDone={() => setAddingExtra(false)} />
              ) : (
                <button type="button" onClick={() => setAddingExtra(true)} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#233c5e] underline">
                  <Plus size={14} /> Aggiungi una variazione (extra, spesa, sconto)
                </button>
              ))}
            </div>
          )}

          {block && o.phase === "svolto" && <p className="mt-3 text-xs text-slate-500">Non ancora fatturabile: {block}.</p>}

          {/* Azioni */}
          <div className="mt-4 flex flex-wrap gap-2">
            {waiting && !declining && (
              <>
                <button type="button" disabled={pending} onClick={() => run(() => confirmOrder(o.id), "Confermato.")} className={`${btn} bg-emerald-600 text-white`}><Check size={16} /> Conferma</button>
                <button type="button" disabled={pending} onClick={() => setDeclining(true)} className={`${btn} border border-[#e6d7bb] text-slate-700`}><X size={16} /> Rifiuta</button>
              </>
            )}
            {canEdit && !editing && (
              <button type="button" onClick={() => setEditing(true)} className={`${btn} border border-[#e6d7bb] text-[#233c5e]`}><Pencil size={15} /> {waiting ? "Proponi una modifica" : "Modifica"}</button>
            )}
            {canCancel && !cancelAsk && (
              <button type="button" onClick={() => setCancelAsk(true)} className={`${btn} text-[#b0413e]`}>{waitingOther ? "Ritira la richiesta" : "Annulla il servizio"}</button>
            )}
            {o.invoice_id && (
              <Link href={`${invoiceBase}/${o.invoice_id}`} className={`${btn} border border-[#e6d7bb] text-[#233c5e]`}><FileText size={15} /> Apri la fattura</Link>
            )}
            {o.role === "buyer" && o.invoice_id && o.buyer_service_id && o.invoice_status !== "bozza" && (
              <button type="button" disabled={pending} onClick={() => run(() => syncServiceCost(o.id), "Costo del viaggio aggiornato con l'importo fatturato.")} className={`${btn} border border-[#e6d7bb] text-slate-700`}>
                Copia l&apos;importo fatturato nel costo del viaggio
              </button>
            )}
          </div>
          {waitingOther && <p className="mt-2 text-xs text-slate-500">In attesa della conferma di {o.counterpart_name}.</p>}

          {declining && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Motivo (facoltativo): es. non disponibile in quella data" className={`${input} max-w-md`} />
              <button type="button" disabled={pending} onClick={() => run(() => declineOrder(o.id, reason), "Rifiutato.")} className={`${btn} bg-[#b0413e] text-white`}>Rifiuta</button>
              <button type="button" onClick={() => setDeclining(false)} className={`${btn} text-slate-600`}>Indietro</button>
            </div>
          )}
          {cancelAsk && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {willPay ? (
                <p>La cancellazione gratuita è finita il {fmtDate(o.free_until)}: annullando ora paghi una penale di <strong>{fmtMoney(penaltyPreview, o.currency)}</strong> ({o.penalty_pct}%).</p>
              ) : o.role === "buyer" ? (
                <p>Annulli in tempo: nessuna penale.</p>
              ) : (
                <p>Annulli tu il servizio: il cliente viene avvisato e non paga nulla.</p>
              )}
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={pending} onClick={() => run(async () => { const r = await cancelOrder(o.id); setCancelAsk(false); return r.ok ? { ok: true } : r; }, "Annullato.")} className={`${btn} bg-[#b0413e] text-white`}>Sì, annulla</button>
                <button type="button" onClick={() => setCancelAsk(false)} className={`${btn} text-slate-700`}>No</button>
              </div>
            </div>
          )}
          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {info && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}
        </div>
      )}

      {editing && (
        <Modal title="Modifica l'ordine" onClose={() => setEditing(false)} wide>
          <OrderForm
            mode="edit"
            role={o.role}
            orderId={o.id}
            initial={{
              title: o.title,
              details: o.details ?? "",
              service_date: o.service_date,
              end_date: o.end_date ?? "",
              start_time: o.start_time ?? "",
              place: o.place ?? "",
              pax: o.pax ? String(o.pax) : "",
              reference: o.reference ?? "",
              lead_name: o.lead_name ?? "",
              quantity: String(o.quantity),
              unit: o.unit,
              unit_price: String(o.unit_price),
              currency: o.currency,
              free_cancel_days: String(o.free_cancel_days),
              penalty_pct: String(o.penalty_pct),
            }}
            onDone={() => setEditing(false)}
          />
        </Modal>
      )}
    </article>
  );
}
