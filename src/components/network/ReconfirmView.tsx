"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, CheckCircle2, Clock, Loader2, MapPin, Phone, Users } from "lucide-react";
import { reconfirmServices } from "@/lib/actions/agenda";
import { dayLabel, telLink, type AgendaRow } from "@/lib/network/agenda";
import { fmtMoney } from "@/lib/orders/shared";

// Per l'agenzia: i servizi ordinati ai fornitori nei prossimi giorni, da riconfermare con un tocco
export default function ReconfirmView({ rows }: { rows: AgendaRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const open = rows.filter((r) => !r.reconfirmed);
  const bySupplier = new Map<string, AgendaRow[]>();
  for (const r of rows) bySupplier.set(r.counterpart_name, [...(bySupplier.get(r.counterpart_name) ?? []), r]);

  const run = (key: string, ids: string[]) => {
    setBusy(key);
    setError(null);
    setDone(null);
    start(async () => {
      const res = await reconfirmServices(ids);
      setBusy(null);
      if (!res.ok) setError(res.error);
      else {
        setDone(res.count === 1 ? "Servizio riconfermato: il fornitore è stato avvisato." : `${res.count} servizi riconfermati: i fornitori sono stati avvisati.`);
        router.refresh();
      }
    });
  };

  if (rows.length === 0)
    return (
      <p className="mt-6 flex items-center gap-2 rounded-2xl border border-[#e6d7bb] bg-white px-4 py-4 text-slate-700">
        <CheckCircle2 size={20} className="shrink-0 text-emerald-600" /> Non hai servizi confermati da riconfermare nei prossimi giorni.
      </p>
    );

  return (
    <div className="mt-5 space-y-6">
      {open.length > 0 ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("all", open.map((r) => r.id))}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#233c5e] px-5 text-base font-semibold text-white hover:bg-[#17283f] disabled:opacity-60 sm:w-auto"
        >
          {busy === "all" ? <Loader2 size={18} className="animate-spin" /> : <CheckCheck size={18} />} Riconferma tutti ({open.length})
        </button>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
          <CheckCircle2 size={20} className="shrink-0" /> Hai riconfermato tutto: i fornitori sanno che possono contare su di te.
        </p>
      )}
      {done && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{done}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {[...bySupplier.entries()].map(([name, list]) => {
        const pendingIds = list.filter((r) => !r.reconfirmed).map((r) => r.id);
        const phone = list.find((r) => r.counterpart_phone)?.counterpart_phone;
        return (
          <section key={name} className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[#233c5e]">{name}</h2>
              <div className="flex flex-wrap gap-2">
                {phone && (
                  <a href={telLink(phone)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#e6d7bb] px-3 text-sm font-semibold text-[#233c5e] hover:bg-[#faf3e6]"><Phone size={15} /> Chiama</a>
                )}
                {pendingIds.length > 1 && (
                  <button type="button" disabled={pending} onClick={() => run(name, pendingIds)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#233c5e] px-3 text-sm font-semibold text-white disabled:opacity-60">
                    {busy === name ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />} Riconferma i {pendingIds.length} servizi
                  </button>
                )}
              </div>
            </div>
            <ul className="mt-3 divide-y divide-[#f2e2c4]">
              {list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold capitalize text-slate-500">{dayLabel(r.service_date, { weekday: "long", day: "numeric", month: "long" })}{r.start_time ? ` · ore ${r.start_time.slice(0, 5)}` : ""}</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{r.title}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-600">
                      {r.place && <span className="flex items-center gap-1"><MapPin size={13} className="text-[#c58f2d]" /> {r.place}</span>}
                      {(r.pax || r.lead_name) && (
                        <span className="flex items-center gap-1"><Users size={13} className="text-[#c58f2d]" /> {[r.pax ? `${r.pax} persone` : null, r.lead_name ? `rif. ${r.lead_name}` : null].filter(Boolean).join(" · ")}</span>
                      )}
                      <span>{fmtMoney(r.amount, r.currency)} + IVA</span>
                    </p>
                    {r.thread_id && <Link href={`/dashboard/posta/${r.thread_id}`} className="mt-1 inline-block text-sm font-medium text-[#233c5e] underline">Apri la conversazione</Link>}
                  </div>
                  {r.reconfirmed ? (
                    <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-100 px-3 text-sm font-semibold text-emerald-800"><CheckCheck size={15} /> Riconfermato</span>
                  ) : (
                    <button type="button" disabled={pending} onClick={() => run(r.id, [r.id])} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#233c5e] px-4 text-sm font-semibold text-[#233c5e] hover:bg-[#233c5e]/5 disabled:opacity-60">
                      {busy === r.id ? <Loader2 size={15} className="animate-spin" /> : <Clock size={15} />} Riconferma
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
