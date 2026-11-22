"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { setTripCountries } from "@/lib/actions/tripCountries";
import { countryOptions, flagOf, nameItOfCode } from "@/lib/geo/countryCodes";

// Paesi del viaggio: quelli ricavati dall'itinerario + quelli aggiunti a mano (servono al mappamondo dell'agenzia)
export default function TripCountriesDialog({
  tripId,
  manual,
  auto,
  onClose,
}: {
  tripId: string;
  manual: string[];
  auto: string[] | null;
  onClose: () => void;
}) {
  const [codes, setCodes] = useState<string[]>(manual);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => countryOptions(), []);
  const matches = query.trim().length >= 1 ? options.filter((o) => o.name.toLowerCase().startsWith(query.trim().toLowerCase()) && !codes.includes(o.code)).slice(0, 8) : [];

  async function save() {
    setBusy(true);
    setError(null);
    const res = await setTripCountries(tripId, codes);
    setBusy(false);
    if (res.ok) onClose();
    else setError(res.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Paesi del viaggio">
      <div className="w-full max-w-md rounded-2xl bg-[#faf3e6] p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[#233c5e]">Paesi del viaggio</h2>
            <p className="text-sm text-slate-600">Servono al mappamondo dell&apos;agenzia per contare i viaggi venduti paese per paese.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-black/5">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">Dall&apos;itinerario (automatici)</p>
        <p className="mb-3 mt-1 text-sm text-slate-700">
          {auto === null
            ? "Si calcolano alla prossima apertura dell'Atlante."
            : auto.length === 0
              ? "Nessuna località riconosciuta nell'itinerario."
              : auto.map((c) => `${flagOf(c)} ${nameItOfCode(c)}`).join(" · ")}
        </p>

        <p className="text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">Aggiunti a mano</p>
        <div className="mb-2 mt-1 flex flex-wrap gap-1.5">
          {codes.length === 0 && <span className="text-sm text-slate-500">Nessuno</span>}
          {codes.map((c) => (
            <span key={c} className="flex items-center gap-1 rounded-full border border-[#e6d7bb] bg-white py-1 pl-2.5 pr-1 text-sm">
              {flagOf(c)} {nameItOfCode(c)}
              <button type="button" aria-label={`Togli ${nameItOfCode(c)}`} onClick={() => setCodes((l) => l.filter((x) => x !== c))} className="grid h-5 w-5 place-items-center rounded-full text-slate-500 hover:bg-black/5">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca un paese da aggiungere…"
            className="w-full rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-sm focus:border-[#233c5e] focus:outline-none"
          />
          {matches.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-[#e6d7bb] bg-white shadow-lg">
              {matches.map((o) => (
                <li key={o.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setCodes((l) => [...l, o.code]);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#f6eedc]"
                  >
                    {flagOf(o.code)} {o.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-black/5">
            Annulla
          </button>
          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-2 rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3050] disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />} Salva
          </button>
        </div>
      </div>
    </div>
  );
}
