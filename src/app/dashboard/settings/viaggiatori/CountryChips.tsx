"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { countryOptions, flagOf } from "@/lib/geo/countryCodes";

const n = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Scelta di più paesi scrivendo il nome; i codici vanno nel modulo come «countries»
export default function CountryChips({ initial }: { initial: string[] }) {
  const options = countryOptions();
  const [codes, setCodes] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const q = n(query);
  const suggestions = q.length >= 2 ? options.filter((o) => !codes.includes(o.code) && n(o.name).includes(q)).slice(0, 8) : [];
  const nameOf = (code: string) => options.find((o) => o.code === code)?.name ?? code;
  return (
    <div>
      {codes.map((c) => (
        <input key={c} type="hidden" name="countries" value={c} />
      ))}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {codes.map((c) => (
          <span key={c} className="flex items-center gap-1 rounded-full border border-[#e6d7bb] bg-[#faf3e6] py-1 pl-2.5 pr-1.5 text-sm text-[#233c5e]">
            {flagOf(c)} {nameOf(c)}
            <button type="button" aria-label={`Togli ${nameOf(c)}`} onClick={() => setCodes(codes.filter((x) => x !== c))} className="rounded-full p-0.5 text-slate-400 hover:text-red-600">
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (suggestions[0]) {
              setCodes([...codes, suggestions[0].code]);
              setQuery("");
            }
          }
        }}
        placeholder="Scrivi un paese (es. Giappone) e scegli"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
      />
      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => {
                setCodes([...codes, o.code]);
                setQuery("");
              }}
              className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1 text-sm text-[#233c5e] hover:bg-[#faf3e6]"
            >
              {flagOf(o.code)} {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
