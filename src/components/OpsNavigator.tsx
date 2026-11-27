"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import OpsSheet from "@/components/OpsSheet";
import { loadOpsPeriod } from "@/lib/actions/opsSheet";
import { isoDate, parseIsoDate, type OpsRow, type OpsView } from "@/lib/opsSheet";

type Period = { view: OpsView; anchor: string; from: string; to: string; rows: OpsRow[] };
type SheetProps = Omit<React.ComponentProps<typeof OpsSheet>, "initialRows" | "view" | "anchor" | "from" | "to" | "onNavigate" | "busy">;

const keyOf = (view: OpsView, anchor: string) => `${view}|${anchor}`;
// periodo precedente/successivo nella stessa vista (come le frecce dell'Operativo)
function neighbour(view: OpsView, anchor: string, dir: 1 | -1) {
  const d = parseIsoDate(anchor);
  if (view === "mese") return isoDate(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  d.setDate(d.getDate() + dir * (view === "settimana" ? 7 : 1));
  return isoDate(d);
}

// L'Operativo cambia giorno, settimana o mese senza ricaricare la pagina: chiede solo le righe del nuovo periodo
// e tiene già pronti quello prima e quello dopo, così le frecce rispondono subito.
export default function OpsNavigator({ initial, ...sheet }: { initial: Period } & SheetProps) {
  const [period, setPeriod] = useState<Period>(initial);
  const [busy, setBusy] = useState(false);
  const cache = useRef(new Map<string, Promise<Period | null>>());
  const latest = useRef(0);

  const fetchPeriod = useCallback((view: OpsView, anchor: string) => {
    const k = keyOf(view, anchor);
    let p = cache.current.get(k);
    if (!p) {
      p = loadOpsPeriod(view, anchor).then(
        (r) => (r.ok ? { view: r.view, anchor: r.anchor, from: r.from, to: r.to, rows: r.rows } : null),
        () => null,
      );
      cache.current.set(k, p);
      // un errore non resta in memoria: si potrà riprovare
      void p.then((v) => {
        if (!v) cache.current.delete(k);
      });
    }
    return p;
  }, []);

  // periodi vicini pronti in anticipo (si rileggono dal database solo se non ci sono già)
  useEffect(() => {
    if (period.view === "viaggio") return;
    const t = setTimeout(() => {
      void fetchPeriod(period.view, neighbour(period.view, period.anchor, 1));
      void fetchPeriod(period.view, neighbour(period.view, period.anchor, -1));
    }, 300);
    return () => clearTimeout(t);
  }, [period.view, period.anchor, fetchPeriod]);

  const navigate = useCallback(
    async (view: OpsView, anchor: string) => {
      const ticket = ++latest.current;
      setBusy(true);
      // le righe in memoria possono essere vecchie (modifiche fatte nel frattempo): si rileggono sempre,
      // ma se il periodo era già pronto si mostra subito e poi si aggiorna
      const cached = cache.current.get(keyOf(view, anchor));
      cache.current.delete(keyOf(view, anchor));
      const fresh = fetchPeriod(view, anchor);
      const first = cached ? await cached : null;
      if (first && ticket === latest.current) {
        setPeriod(first);
        window.history.replaceState(null, "", `/dashboard/operativo?v=${view}&d=${anchor}`);
      }
      const next = await fresh;
      if (ticket !== latest.current) return;
      if (next) {
        setPeriod(next);
        window.history.replaceState(null, "", `/dashboard/operativo?v=${view}&d=${anchor}`);
      }
      setBusy(false);
    },
    [fetchPeriod],
  );

  return (
    <OpsSheet
      key={`${period.view}-${period.from}-${period.rows.length}-${period.rows[0]?.id ?? ""}`}
      {...sheet}
      initialRows={period.rows}
      view={period.view}
      anchor={period.anchor}
      from={period.from}
      to={period.to}
      onNavigate={period.view === "viaggio" ? undefined : navigate}
      busy={busy}
    />
  );
}
