import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ServiceCard from "@/components/network/ServiceCard";
import { addDays, fmtMoney } from "@/lib/orders/shared";
import { agendaRange, dayLabel, onDay, waitingForMe, type AgendaRow } from "@/lib/network/agenda";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// Agenda dei servizi (fornitori e agenzie): settimana da scorrere sul telefono, mese a colpo d'occhio.
export default function AgendaView({ me, today, vista, refDate, rows, error }: { me: string; today: string; vista: "settimana" | "mese"; refDate: string; rows: AgendaRow[]; error: boolean }) {
  const user = { id: me };
  const { from, to, prev, next, title } = agendaRange(vista, refDate);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

  const inPeriod = vista === "mese" ? rows.filter((r) => r.service_date.slice(0, 7) === refDate.slice(0, 7)) : rows;
  const totals = new Map<string, number>();
  for (const r of inPeriod.filter((r) => r.role === "seller")) totals.set(r.currency, (totals.get(r.currency) ?? 0) + Number(r.amount));
  const toConfirm = inPeriod.filter((r) => waitingForMe(r, user.id)).length;

  const link = (params: { vista?: string; data?: string }) => {
    const q = new URLSearchParams();
    const vv = params.vista ?? vista;
    if (vv === "mese") q.set("vista", "mese");
    if (params.data && params.data !== today) q.set("data", params.data);
    const s = q.toString();
    return s ? `/rete/agenda?${s}` : "/rete/agenda";
  };
  const navBtn = "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-[#e6d7bb] bg-white px-3 text-sm font-semibold text-[#233c5e] transition hover:bg-[#faf3e6] active:scale-[0.97]";

  return (
    <div>
      <p className="eyebrow">Partner</p>
      <h1 className="mt-1 text-3xl text-[#233c5e]">Agenda</h1>

      {/* Settimana / Mese e spostamento */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[#e6d7bb] bg-white p-1">
          {(["settimana", "mese"] as const).map((k) => (
            <Link
              key={k}
              href={link({ vista: k, data: refDate })}
              aria-current={vista === k ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${vista === k ? "bg-[#233c5e] text-white" : "text-[#6b5f4a] hover:bg-[#faf3e6]"}`}
            >
              {k}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Link href={link({ data: prev })} className={navBtn} aria-label={vista === "mese" ? "Mese precedente" : "Settimana precedente"}><ChevronLeft size={18} /></Link>
          <Link href={link({ data: today })} className={navBtn}>Oggi</Link>
          <Link href={link({ data: next })} className={navBtn} aria-label={vista === "mese" ? "Mese successivo" : "Settimana successiva"}><ChevronRight size={18} /></Link>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold capitalize text-[#233c5e]">{title}</h2>
        <p className="text-sm text-slate-600">
          {inPeriod.length === 1 ? "1 servizio" : `${inPeriod.length} servizi`}
          {[...totals.entries()].map(([c, n]) => ` · ${fmtMoney(n, c)}`).join("")}
          {toConfirm > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{toConfirm} da confermare</span>}
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Per usare l&apos;agenda serve l&apos;aggiornamento del database (migrazione 0069, in Supabase → SQL Editor).
        </p>
      )}

      {vista === "settimana" ? (
        <div className="mt-4 space-y-5">
          {days.map((d) => {
            const items = rows.filter((r) => onDay(r, d));
            const isToday = d === today;
            return (
              <section key={d} id={`giorno-${d}`} className="scroll-mt-24">
                <p className={`mb-1.5 flex items-center gap-2 text-sm font-semibold capitalize ${isToday ? "text-[#233c5e]" : "text-slate-600"}`}>
                  {dayLabel(d)}
                  {isToday && <span className="rounded-full bg-[#233c5e] px-2 py-0.5 text-[11px] font-semibold normal-case text-white">Oggi</span>}
                </p>
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#e6d7bb] px-3 py-2 text-sm text-slate-400">Nessun servizio</p>
                ) : (
                  <div className="space-y-3">
                    {items.map((r) => (
                      <ServiceCard key={`${r.id}-${d}`} row={r} me={user.id} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white">
          <div className="grid grid-cols-7 border-b border-[#e6d7bb] bg-[#faf3e6] text-center text-xs font-semibold uppercase text-[#a08a5e]">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-2">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const items = rows.filter((r) => onDay(r, d));
              const other = d.slice(0, 7) !== refDate.slice(0, 7);
              const waiting = items.some((r) => waitingForMe(r, user.id));
              return (
                <Link
                  key={d}
                  href={`${link({ vista: "settimana", data: d })}#giorno-${d}`}
                  className={`min-h-16 border-b border-r border-[#f2e2c4] p-1 text-left transition hover:bg-[#faf3e6] sm:min-h-24 sm:p-1.5 ${other ? "bg-[#fbf8f1] text-slate-400" : ""}`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${d === today ? "bg-[#233c5e] text-white" : ""}`}>
                    {Number(d.slice(8, 10))}
                  </span>
                  {items.length > 0 && (
                    <>
                      {/* telefono: solo il numero dei servizi */}
                      <span className={`mt-0.5 block rounded-md px-1 text-center text-[11px] font-semibold sm:hidden ${waiting ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-800"}`}>
                        {items.length}
                      </span>
                      {/* computer: i titoli */}
                      <span className="mt-0.5 hidden space-y-0.5 sm:block">
                        {items.slice(0, 3).map((r) => (
                          <span
                            key={r.id}
                            className={`block truncate rounded px-1 text-[11px] font-medium ${waitingForMe(r, user.id) ? "bg-amber-100 text-amber-900" : r.phase === "svolto" || r.phase === "fatturato" ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-900"}`}
                          >
                            {r.start_time ? `${r.start_time.slice(0, 5)} ` : ""}
                            {r.title}
                          </span>
                        ))}
                        {items.length > 3 && <span className="block px-1 text-[11px] text-slate-500">+{items.length - 3} altri</span>}
                      </span>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {vista === "mese" && <p className="mt-2 text-xs text-slate-500">Tocca un giorno per vedere i servizi di quella settimana.</p>}
    </div>
  );
}
