"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Loader2, MapPin, MessageSquare, Phone, Users } from "lucide-react";
import { confirmOrder } from "@/lib/actions/orders";
import { reconfirmServices } from "@/lib/actions/agenda";
import { PHASES, fmtDate, fmtMoney } from "@/lib/orders/shared";
import { kindLabel } from "@/lib/network/kinds";
import { mapsLink, needsReconfirm, telLink, waitingForMe, type AgendaRow } from "@/lib/network/agenda";

// Un servizio in Home e in Agenda, pensato per il telefono: orario grande e tasti larghi
// (conferma, chiama, mappa, messaggi) che si premono bene anche col pollice.
export default function ServiceCard({ row, me, today, showDate = false }: { row: AgendaRow; me: string; today: string; showDate?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const waiting = waitingForMe(row, me);
  const mustReconfirm = row.role === "buyer" && needsReconfirm(row, today);
  const phase = PHASES[row.phase];
  const time = row.start_time ? row.start_time.slice(0, 5) : null;
  const multiDay = row.end_date && row.end_date !== row.service_date;
  const openHref = row.thread_id ? `/rete/posta/${row.thread_id}` : row.role === "seller" ? "/rete/lavori" : "/rete/lavori?vista=ordini";

  const action = "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold sm:flex-none";

  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${waiting ? "border-[#c58f2d]" : "border-[#e6d7bb]"}`}>
      <div className="flex items-start gap-3">
        <div className="w-16 shrink-0 rounded-xl bg-[#faf3e6] px-1 py-2 text-center">
          {showDate && <p className="text-[11px] font-semibold uppercase text-[#a08a5e]">{fmtDate(row.service_date, { weekday: "short", day: "numeric" })}</p>}
          <p className={time ? "text-lg font-semibold leading-tight text-[#233c5e]" : "text-xs font-semibold leading-tight text-[#233c5e]"}>{time ?? (multiDay ? "Più giorni" : "Orario da definire")}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${waiting ? "bg-amber-100 text-amber-900" : phase.tone}`}>
              {waiting ? "Tocca a te confermare" : phase.label}
            </span>
            <span className="text-sm font-semibold text-[#233c5e]">{fmtMoney(row.amount, row.currency)}</span>
            {row.status === "confermato" && row.reconfirmed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"><CheckCheck size={13} /> Riconfermato</span>
            )}
            {row.role === "seller" && needsReconfirm(row, today) && (
              <span className="rounded-full border border-amber-300 px-2.5 py-0.5 text-xs font-medium text-amber-800">In attesa di riconferma</span>
            )}
          </div>
          <p className="mt-1 text-base font-semibold leading-snug text-slate-900">{row.title}</p>
          <p className="text-sm text-slate-600">
            {row.role === "seller" ? "Per " : "Da "}
            <span className="font-medium text-slate-800">{row.counterpart_name}</span> · {kindLabel(row.counterpart_kind)}
          </p>
          <div className="mt-1.5 space-y-0.5 text-sm text-slate-600">
            {row.place && <p className="flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0 text-[#c58f2d]" /> {row.place}</p>}
            {(row.pax || row.lead_name) && (
              <p className="flex items-start gap-1.5">
                <Users size={14} className="mt-0.5 shrink-0 text-[#c58f2d]" />
                {[row.pax ? `${row.pax} ${row.pax === 1 ? "persona" : "persone"}` : null, row.lead_name ? `rif. ${row.lead_name}` : null].filter(Boolean).join(" · ")}
              </p>
            )}
            {multiDay && <p className="text-xs text-slate-500">Fino al {fmtDate(row.end_date, { weekday: "short", day: "numeric", month: "short" })}</p>}
            {row.reference && <p className="text-xs text-slate-500">Riferimento: {row.reference}</p>}
          </div>
        </div>
      </div>
      {row.details && <p className="mt-2 line-clamp-3 whitespace-pre-line rounded-lg bg-[#faf7ee] px-3 py-2 text-sm text-slate-700">{row.details}</p>}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {waiting && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await confirmOrder(row.id);
                if (!r.ok) setError(r.error);
                else router.refresh();
              })
            }
            className={`${action} w-full bg-emerald-600 text-white sm:w-auto`}
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Conferma
          </button>
        )}
        {mustReconfirm && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await reconfirmServices([row.id]);
                if (!r.ok) setError(r.error);
                else router.refresh();
              })
            }
            className={`${action} w-full bg-[#233c5e] text-white sm:w-auto`}
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />} Riconferma
          </button>
        )}
        {row.counterpart_phone && (
          <a href={telLink(row.counterpart_phone)} className={`${action} border border-[#e6d7bb] bg-white text-[#233c5e] transition hover:border-[#c58f2d] hover:bg-[#faf3e6] active:scale-[0.97]`}>
            <Phone size={16} /> Chiama
          </a>
        )}
        {row.place && (
          <a href={mapsLink(row.place)} target="_blank" rel="noopener noreferrer" className={`${action} border border-[#e6d7bb] bg-white text-[#233c5e] transition hover:border-[#c58f2d] hover:bg-[#faf3e6] active:scale-[0.97]`}>
            <MapPin size={16} /> Mappa
          </a>
        )}
        <Link href={openHref} className={`${action} border border-[#e6d7bb] bg-white text-[#233c5e] transition hover:border-[#c58f2d] hover:bg-[#faf3e6] active:scale-[0.97]`}>
          <MessageSquare size={16} /> {row.thread_id ? "Messaggi" : "Dettagli"}
        </Link>
      </div>
    </article>
  );
}
