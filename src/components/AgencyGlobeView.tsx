"use client";

import { useMemo, useState } from "react";
import GlobeLoader from "@/components/GlobeLoader";
import CountrySheetPanel from "@/components/CountrySheetPanel";
import type { AgencyCountryStat, AgencyGlobeData } from "@/components/TravelGlobe";
import { codeOf, flagOf, nameItOfCode, namesOf } from "@/lib/geo/countryCodes";

export type AgencyTrip = {
  id: string;
  title: string;
  client: string | null;
  from: string | null;
  countries: string[]; // codici ISO
  confirmed: boolean;
  paid: boolean;
  value: number;
};

type Mode = "sold" | "confirmed" | "all";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "sold", label: "Venduti", hint: "Viaggi confermati (itinerario finale o approvato dal cliente) con tutti gli incassi registrati pagati." },
  { id: "confirmed", label: "Confermati", hint: "Viaggi con itinerario finale o approvato dal cliente, anche se non ancora saldati." },
  { id: "all", label: "Tutti", hint: "Tutti i viaggi, compresi i preventivi." },
];
// pezzi minori che condividono il codice di un paese più grande: niente numero sopra
const MINOR = new Set(["Baikonur", "Ashmore and Cartier Is."]);
const NO_TRIPS: [] = [];
const euro = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function AgencyGlobeView({ trips, pending }: { trips: AgencyTrip[]; pending: number }) {
  const [mode, setMode] = useState<Mode>("sold");
  const years = useMemo(() => [...new Set(trips.map((t) => t.from?.slice(0, 4)).filter((y): y is string => !!y))].sort().reverse(), [trips]);
  const [year, setYear] = useState<string>("all");
  const [focus, setFocus] = useState<{ name: string; nonce: number } | null>(null);
  const [sheet, setSheet] = useState<{ code: string; name: string } | null>(null);

  const filtered = useMemo(
    () =>
      trips.filter(
        (t) =>
          (mode === "all" || (mode === "confirmed" ? t.confirmed : t.confirmed && t.paid)) && (year === "all" || t.from?.startsWith(year)),
      ),
    [trips, mode, year],
  );

  const { data, ranking, withoutCountry } = useMemo(() => {
    const stats: Record<string, AgencyCountryStat> = {};
    const byCode = new Map<string, { code: string; count: number; value: number }>();
    let without = 0;
    for (const t of filtered) {
      if (t.countries.length === 0) {
        without++;
        continue;
      }
      // un viaggio in più paesi conta in ognuno; il valore si divide in parti uguali
      const share = t.value / t.countries.length;
      for (const code of t.countries) {
        const r = byCode.get(code) ?? { code, count: 0, value: 0 };
        r.count++;
        r.value += share;
        byCode.set(code, r);
        const names = namesOf(code);
        for (const name of names) {
          if (MINOR.has(name) && names.length > 1) continue;
          const s = (stats[name] ??= { count: 0, value: 0, trips: [] });
          s.count++;
          s.value += share;
          s.trips.push({ id: t.id, title: t.title, from: t.from, client: t.client });
        }
      }
    }
    const data: AgencyGlobeData = {
      stats,
      countLabel: mode === "sold" ? "viaggi venduti" : mode === "confirmed" ? "viaggi confermati" : "viaggi",
      showValue: mode !== "all",
    };
    const ranking = [...byCode.values()].sort((a, b) => b.count - a.count || b.value - a.value);
    return { data, ranking, withoutCountry: without };
  }, [filtered, mode]);

  const totalValue = filtered.reduce((s, t) => s + t.value, 0);

  function openSheet(name: string) {
    const code = codeOf(name);
    if (code) setSheet({ code, name: nameItOfCode(code) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-[#e6d7bb] bg-white text-sm" role="group" aria-label="Quali viaggi contare">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.hint}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`px-3.5 py-1.5 font-medium transition ${mode === m.id ? "bg-[#233c5e] text-white" : "text-[#1d2b40] hover:bg-[#f6eedc]"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          aria-label="Anno di partenza"
          className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 text-sm"
        >
          <option value="all">Tutti gli anni</option>
          {years.map((y) => (
            <option key={y} value={y}>
              Partenze {y}
            </option>
          ))}
        </select>
        <p className="text-sm text-slate-600">
          <strong className="text-[#233c5e]">{filtered.length}</strong> {filtered.length === 1 ? "viaggio" : "viaggi"} in{" "}
          <strong className="text-[#233c5e]">{ranking.length}</strong> {ranking.length === 1 ? "paese" : "paesi"}
          {mode !== "all" && totalValue > 0 ? ` · ${euro(totalValue)} di incassi` : ""}
        </p>
      </div>
      <p className="-mt-2 text-xs text-slate-500">{MODES.find((m) => m.id === mode)?.hint}</p>

      {pending > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sto ancora ricavando i paesi di {pending} {pending === 1 ? "viaggio" : "viaggi"} dai loro itinerari: ricarica la pagina tra poco per vederli sul globo.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <GlobeLoader trips={NO_TRIPS} mode="agency" agency={data} onOpenSheet={openSheet} focusRequest={focus} />

        <aside className="flex flex-col gap-2 rounded-2xl border border-[#e6d7bb] bg-white/80 p-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">Classifica dei paesi</h2>
          {ranking.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nessun viaggio con questi filtri. {mode === "sold" ? "Prova «Confermati» o «Tutti» per vedere anche i viaggi non ancora saldati." : ""}
            </p>
          ) : (
            <ol className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
              {ranking.map((r, i) => {
                const name = namesOf(r.code)[0];
                return (
                  <li key={r.code}>
                    <button
                      type="button"
                      onClick={() => name && setFocus({ name, nonce: Date.now() })}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-[#f6eedc]"
                    >
                      <span className="w-5 text-right text-xs text-slate-400">{i + 1}</span>
                      <span className="text-lg leading-none">{flagOf(r.code)}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-[#1d2b40]">{nameItOfCode(r.code)}</span>
                      <span className="rounded-full bg-[#233c5e] px-2 py-0.5 text-xs font-bold text-white">{r.count}</span>
                      {mode !== "all" && r.value > 0 && <span className="w-16 text-right text-xs text-slate-500">{euro(r.value)}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          {withoutCountry > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {withoutCountry} {withoutCountry === 1 ? "viaggio non ha" : "viaggi non hanno"} località riconoscibili: aggiungi i paesi a mano nelle opzioni del viaggio (menu «Altro» → «Paesi del viaggio»).
            </p>
          )}
          <p className="mt-auto pt-2 text-xs text-slate-500">Un viaggio in più paesi conta in ognuno; il valore degli incassi si divide in parti uguali.</p>
        </aside>
      </div>

      {sheet && <CountrySheetPanel key={sheet.code} code={sheet.code} name={sheet.name} onClose={() => setSheet(null)} />}
    </div>
  );
}
