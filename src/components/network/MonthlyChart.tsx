"use client";

import { useState } from "react";
import { niceMax } from "@/lib/network/stats";

type Month = { month: string; services: number; revenue: number };

const monthShort = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("it-IT", { month: "short", timeZone: "UTC" }).replace(".", "");
const monthLong = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });

// Andamento mensile del fatturato: una serie sola (nessuna legenda), colonne sottili con angoli arrotondati in alto.
// I mesi del periodo scelto sono in blu pieno, gli altri in una tinta più chiara. Il valore compare al passaggio
// (o con la tastiera); il picco ha l'etichetta; la tabella mostra tutti i numeri.
export default function MonthlyChart({ months, currency, from, to }: { months: Month[]; currency: string; from: string; to: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const fmtFull = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency, maximumFractionDigits: 0 });
  const fmtAxis = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 0 });
  const max = niceMax(Math.max(0, ...months.map((m) => m.revenue)));
  const peak = months.reduce((best, m, i) => (m.revenue > (months[best]?.revenue ?? 0) ? i : best), 0);
  const inPeriod = (m: string) => m >= from.slice(0, 7) && m <= to.slice(0, 7);
  const H = 176;
  const total = months.reduce((s, m) => s + m.revenue, 0);

  return (
    <div>
      {total === 0 ? (
        <p className="rounded-xl bg-[#faf7ee] px-4 py-6 text-center text-sm text-slate-600">Nessun servizio svolto negli ultimi 12 mesi: quando ne avrai, qui vedrai l&apos;andamento.</p>
      ) : table ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-[#e6d7bb] text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-2 font-semibold">Mese</th>
                <th className="py-2 pr-2 text-right font-semibold">Servizi svolti</th>
                <th className="py-2 text-right font-semibold">Fatturato</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className="border-b border-[#f2e2c4]">
                  <td className="py-1.5 pr-2 capitalize">{monthLong(m.month)}</td>
                  <td className="py-1.5 pr-2 text-right">{m.services}</td>
                  <td className="py-1.5 text-right font-medium">{fmtFull(m.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2" onPointerLeave={() => setActive(null)}>
          {/* asse verticale */}
          <div className="relative w-10 shrink-0 text-right text-[11px] text-slate-500" style={{ height: H }} aria-hidden>
            {[1, 0.5, 0].map((f) => (
              <span key={f} className="absolute right-0 -translate-y-1/2" style={{ top: (1 - f) * H }}>{fmtAxis(max * f)}</span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: H }}>
              {[0, 0.5, 1].map((f) => (
                <div key={f} className="absolute inset-x-0 border-t border-[#f2e8d2]" style={{ top: (1 - f) * H }} aria-hidden />
              ))}
              <div className="absolute inset-0 flex">
                {months.map((m, i) => {
                  const h = Math.max(m.revenue > 0 ? 3 : 0, Math.round((m.revenue / max) * H));
                  const on = active === i;
                  const anchor = i < 2 ? "left-0" : i > months.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";
                  return (
                    <button
                      key={m.month}
                      type="button"
                      data-nofx
                      aria-label={`${monthLong(m.month)}: ${fmtFull(m.revenue)}, ${m.services} ${m.services === 1 ? "servizio" : "servizi"}`}
                      className="relative flex h-full min-w-0 flex-1 items-end justify-center outline-none focus-visible:bg-[#faf3e6]"
                      onPointerEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                    >
                      <span
                        className="block w-full max-w-6 rounded-t-[4px] transition-opacity"
                        style={{ height: h, backgroundColor: inPeriod(m.month) ? "#233c5e" : "#b4c0d3", opacity: active != null && !on ? 0.55 : 1 }}
                      />
                      {i === peak && m.revenue > 0 && active == null && (
                        <span className="pointer-events-none absolute -translate-y-1 whitespace-nowrap text-[11px] font-medium text-slate-600" style={{ bottom: h + 2 }}>{fmtAxis(m.revenue)}</span>
                      )}
                      {on && (
                        <span className={`pointer-events-none absolute z-10 w-max max-w-[11rem] rounded-lg border border-[#e6d7bb] bg-white px-3 py-2 text-left shadow-lg ${anchor}`} style={{ bottom: h + 8 }}>
                          <span className="block text-base font-semibold text-slate-900">{fmtFull(m.revenue)}</span>
                          <span className="block text-xs capitalize text-slate-500">{monthLong(m.month)}</span>
                          <span className="block text-xs text-slate-500">{m.services} {m.services === 1 ? "servizio svolto" : "servizi svolti"}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* mesi */}
            <div className="mt-1.5 flex" aria-hidden>
              {months.map((m, i) => (
                <span key={m.month} className="min-w-0 flex-1 text-center text-[11px] capitalize leading-tight text-slate-500">
                  {monthShort(m.month)}
                  {(m.month.endsWith("-01") || (i === 0 && !months[1]?.month.endsWith("-01"))) && <span className="block text-[10px] text-slate-400">{m.month.slice(0, 4)}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {total > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#233c5e]" /> periodo scelto</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#b4c0d3]" /> altri mesi</span>
          </span>
          <button type="button" onClick={() => setTable((v) => !v)} className="font-medium text-[#233c5e] underline">{table ? "Torna al grafico" : "Vedi come tabella"}</button>
        </div>
      )}
    </div>
  );
}
