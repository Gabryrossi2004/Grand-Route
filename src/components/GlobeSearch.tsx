"use client";

import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { countryOptions, flagOf } from "@/lib/geo/countryCodes";

export type GlobeSearchItem = { kind: "country"; code: string; name: string } | { kind: "region"; code: string; name: string };

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();

// Ricerca di un paese (e, nel mappamondo dell'agenzia, di una regione italiana) da centrare sul globo
export default function GlobeSearch({ regions, onPick }: { regions: { code: string; name: string }[]; onPick: (item: GlobeSearchItem) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo<(GlobeSearchItem & { key: string })[]>(
    () => [
      ...countryOptions().map((c) => ({ kind: "country" as const, code: c.code, name: c.name, key: fold(c.name) })),
      ...regions.map((r) => ({ kind: "region" as const, code: r.code, name: r.name, key: fold(r.name) })),
    ],
    [regions],
  );

  const results = useMemo(() => {
    const f = fold(q);
    if (!f) return [];
    const starts = all.filter((i) => i.key.startsWith(f) || i.key.split(" ").some((w) => w.startsWith(f)));
    const contains = all.filter((i) => !starts.includes(i) && i.key.includes(f));
    return [...starts, ...contains].slice(0, 8);
  }, [q, all]);

  const pick = (item: GlobeSearchItem) => {
    onPick(item);
    setOpen(false);
    setQ("");
    setActive(0);
  };

  if (!open)
    return (
      <button
        type="button"
        aria-label="Cerca un paese"
        title="Cerca un paese"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur hover:bg-black/60"
      >
        <Search size={16} />
      </button>
    );

  return (
    <div className="w-[min(18rem,calc(100vw-5rem))] overflow-hidden rounded-2xl border border-white/25 bg-[#faf3e6] shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2">
        <Search size={15} className="shrink-0 text-slate-500" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) pick(results[active]);
          }}
          placeholder={regions.length ? "Cerca un paese o una regione…" : "Cerca un paese…"}
          aria-label="Cerca un paese"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#1d2b40] outline-none focus:shadow-none"
          style={{ boxShadow: "none" }}
        />
        <button type="button" aria-label="Chiudi la ricerca" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
          <X size={15} />
        </button>
      </div>
      {q.trim() && (
        <ul className="max-h-64 overflow-y-auto border-t border-[#e6d7bb] py-1" role="listbox">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Nessun risultato</li>}
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.code}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === active ? "bg-[#f1e4c6]" : ""}`}
              >
                <span className="w-5 text-center text-base leading-none">{r.kind === "country" ? flagOf(r.code) : "🇮🇹"}</span>
                <span className="min-w-0 flex-1 truncate text-[#1d2b40]">{r.name}</span>
                {r.kind === "region" && <span className="text-[11px] text-slate-500">regione</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
