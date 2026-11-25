"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";

// Barra di ricerca dei Partner: l'elenco si aggiorna da solo mentre scrivi o cambi paese / attività
export default function PartnerSearchBar({
  q,
  paese,
  tipo,
  countries,
  kinds,
  children,
}: {
  q: string;
  paese: string;
  tipo: string;
  countries: { code: string; name: string }[];
  kinds: { value: string; label: string }[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [text, setText] = useState(q);
  const [country, setCountry] = useState(paese);
  const [kind, setKind] = useState(tipo);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function go(next: { q?: string; paese?: string; tipo?: string }) {
    const params = new URLSearchParams();
    const v = { q: text, paese: country, tipo: kind, ...next };
    if (v.q.trim()) params.set("q", v.q.trim());
    if (v.paese) params.set("paese", v.paese);
    if (v.tipo) params.set("tipo", v.tipo);
    const qs = params.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const hasFilters = !!(text.trim() || country || kind);
  return (
    <>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          go({});
        }}
        className="mt-5 grid gap-2 rounded-2xl border border-[#e6d7bb] bg-white p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
      >
        <div className="relative">
          <input
            name="q"
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => go({ q: v }), 350);
            }}
            placeholder="Es. guida Kyoto, transfer Sicilia, hotel"
            aria-label="Cerca per nome, città, paese o attività"
            className={`${input} w-full pr-8`}
          />
          {text && (
            <button type="button" aria-label="Cancella" onClick={() => { setText(""); go({ q: "" }); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-700">
              <X size={14} />
            </button>
          )}
        </div>
        <select value={country} onChange={(e) => { setCountry(e.target.value); go({ paese: e.target.value }); }} className={input} aria-label="Paese">
          <option value="">Tutti i paesi</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <select value={kind} onChange={(e) => { setKind(e.target.value); go({ tipo: e.target.value }); }} className={input} aria-label="Tipo di attività">
          <option value="">Tutte le attività</option>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f]">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Cerca
        </button>
      </form>
      {hasFilters && (
        <button
          type="button"
          onClick={() => { setText(""); setCountry(""); setKind(""); go({ q: "", paese: "", tipo: "" }); }}
          className="mt-2 text-sm font-medium text-[#233c5e] underline"
        >
          Togli tutti i filtri
        </button>
      )}
      <div className={`transition-opacity ${pending ? "opacity-50" : ""}`} aria-busy={pending}>{children}</div>
    </>
  );
}
