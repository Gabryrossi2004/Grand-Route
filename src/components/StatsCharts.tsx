// Grafici semplici delle statistiche: una sola serie, valori scritti come testo, dettaglio al passaggio del mouse.

// Barre verticali di una sola serie: valore scritto sopra, mese sotto, dettaglio al passaggio del mouse
export function Columns({ data, format }: { data: { label: string; value: number; hint: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-44 items-end gap-1.5" role="img" aria-label={data.map((d) => `${d.hint}: ${format(d.value)}`).join("; ")}>
      {data.map((d) => (
        <div key={d.hint} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.hint}: ${format(d.value)}`}>
          <span className="text-[10px] font-medium text-slate-600">{d.value ? format(d.value) : ""}</span>
          <div
            className="w-full max-w-9 rounded-t bg-[#233c5e] transition group-hover:bg-[#c58f2d]"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0 }}
          />
          <span className="text-[11px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// Barre orizzontali con nome e valore come testo
export function Bars({ rows, format }: { rows: { label: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}${r.sub ? ` · ${r.sub}` : ""}`} className="group">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate text-slate-800">{r.label}</span>
            <span className="shrink-0 font-medium text-slate-700">
              {format(r.value)}
              {r.sub && <span className="ml-1 font-normal text-slate-500">· {r.sub}</span>}
            </span>
          </div>
          <div className="mt-0.5 h-2 rounded-full bg-[#f1ead9]">
            <div className="h-2 rounded-full bg-[#233c5e] transition group-hover:bg-[#c58f2d]" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

