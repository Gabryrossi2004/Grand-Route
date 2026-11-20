"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { countryOptions, flagOf, nameItOfCode } from "@/lib/geo/countryCodes";
import { ITALY_REGION_NAMES } from "@/lib/italyRegionNames";

// Paesi (e, per l'Italia, regioni) in cui lavora il fornitore: servono a ritrovarlo dalla scheda del paese
export default function SupplierPlacesField({ initialCountries = [], initialRegions = [] }: { initialCountries?: string[]; initialRegions?: string[] }) {
  const [countries, setCountries] = useState<string[]>(initialCountries);
  const [regions, setRegions] = useState<string[]>(initialRegions);
  const [query, setQuery] = useState("");
  const options = useMemo(() => countryOptions(), []);

  const matches = query.trim()
    ? options
        .filter((o) => !countries.includes(o.code) && o.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")))
        .slice(0, 6)
    : [];

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">Paesi in cui lavora</span>
      {countries.map((c) => (
        <input key={c} type="hidden" name="countries" value={c} />
      ))}
      {regions.map((r) => (
        <input key={r} type="hidden" name="regions" value={r} />
      ))}
      {countries.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {countries.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-[#f6eedc] px-2.5 py-1 text-xs text-[#5b4a2c]">
              {flagOf(c)} {nameItOfCode(c)}
              <button type="button" aria-label={`Togli ${nameItOfCode(c)}`} onClick={() => setCountries(countries.filter((x) => x !== c))} className="text-[#a87a1e] hover:text-red-600">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) {
                setCountries([...countries, matches[0].code]);
                setQuery("");
              }
            }
          }}
          placeholder="Scrivi un paese, es. Kenya"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-[#e6d7bb] bg-white py-1 shadow-lg">
            {matches.map((m) => (
              <li key={m.code}>
                <button
                  type="button"
                  onClick={() => {
                    setCountries([...countries, m.code]);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[#faf3e6]"
                >
                  {flagOf(m.code)} {m.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {countries.includes("IT") && (
        <fieldset className="mt-2 rounded-lg border border-[#e6d7bb] p-2.5">
          <legend className="px-1 text-xs text-slate-500">Regioni italiane (nessuna = tutta Italia)</legend>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
            {ITALY_REGION_NAMES.map((r) => (
              <label key={r.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                <input type="checkbox" className="!w-auto" checked={regions.includes(r.id)} onChange={(e) => setRegions(e.target.checked ? [...regions, r.id] : regions.filter((x) => x !== r.id))} />
                {r.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
