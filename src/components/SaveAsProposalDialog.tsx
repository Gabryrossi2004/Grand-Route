"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import { destinationOptions, saveTripAsItinerary, type DestinationOption } from "@/lib/actions/agencyItineraries";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const n = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Scelta di un paese o di una regione italiana scrivendo il nome
export function DestinationSelect({
  options,
  value,
  onChange,
  id,
}: {
  options: DestinationOption[];
  value: DestinationOption | null;
  onChange: (v: DestinationOption | null) => void;
  id?: string;
}) {
  const [query, setQuery] = useState("");
  const q = n(query);
  const suggestions = q.length >= 2 ? options.filter((o) => n(o.label).includes(q)).slice(0, 8) : [];
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-[#cda876] bg-[#faf3e6]/60 px-3 py-2 text-sm">
        <span className="font-medium text-[#233c5e]">
          {value.label}
          {value.kind === "italy" && <span className="ml-1 text-xs font-normal text-slate-500">(regione italiana)</span>}
        </span>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-[#233c5e] underline">
          Cambia
        </button>
      </div>
    );
  }
  return (
    <div>
      <input id={id} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scrivi il paese o la regione (es. Giordania, Toscana)" className={inputClass} />
      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.map((o) => (
            <button
              key={`${o.kind}:${o.key}`}
              type="button"
              onClick={() => {
                onChange(o);
                setQuery("");
              }}
              className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1 text-sm text-[#233c5e] hover:border-[#cda876] hover:bg-[#faf3e6]"
            >
              {o.label}
              {o.kind === "italy" && <span className="ml-1 text-xs text-slate-500">(Italia)</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// «Salva come proposta in Libreria»: il programma di questo viaggio diventa un itinerario dell'agenzia,
// visibile nella scheda del paese (o della regione) e in «Consulta proposte» di Zefiro.
export default function SaveAsProposalDialog({
  tripId,
  tripTitle,
  destination,
  countries,
  onClose,
}: {
  tripId: string;
  tripTitle: string;
  destination: string | null;
  countries: string[];
  onClose: () => void;
}) {
  const [options, setOptions] = useState<DestinationOption[]>([]);
  const [place, setPlace] = useState<DestinationOption | null>(null);
  const [title, setTitle] = useState(tripTitle.slice(0, 160));
  const [description, setDescription] = useState("");
  const [route, setRoute] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const countriesKey = countries.join(",");
  useEffect(() => {
    let alive = true;
    const codes = countriesKey ? countriesKey.split(",") : [];
    destinationOptions()
      .then((opts) => {
        if (!alive) return;
        setOptions(opts);
        // Proposta iniziale: il primo paese del viaggio, oppure la destinazione scritta nel viaggio
        const byCode = codes.length === 1 ? opts.find((o) => o.kind === "country" && o.key === codes[0]) : undefined;
        const dest = destination ? n(destination) : "";
        const byName = dest ? opts.find((o) => n(o.label) === dest) ?? opts.find((o) => dest.includes(n(o.label))) : undefined;
        setPlace((cur) => cur ?? byCode ?? byName ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [countriesKey, destination]);

  async function save() {
    if (!place || title.trim().length < 2 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await saveTripAsItinerary({ tripId, kind: place.kind, key: place.key, label: place.label, title: title.trim(), description, route });
      if (!res.ok) setError(res.error);
      else setDone(true);
    } catch {
      setError("Non sono riuscito a salvare. Controlla la connessione e riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Salva come proposta in Libreria" onClose={() => !saving && onClose()}>
      {done ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>
              Fatto! L&apos;itinerario «{title}» ora compare nella scheda di <strong>{place?.label}</strong> dell&apos;Atlante e in «Consulta proposte» di Zefiro.
            </span>
          </p>
          <div className="flex justify-end gap-2">
            <Link href="/dashboard/library?tab=itinerari" className="rounded-md px-3 py-1.5 text-sm font-medium text-[#233c5e] hover:bg-slate-50">
              Vai alla Libreria
            </Link>
            <button type="button" onClick={onClose} className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f]">
              Chiudi
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="-mt-2 text-sm text-slate-500">
            Il programma giorno per giorno di questo viaggio (attività, hotel, descrizioni) diventa un vostro itinerario: lo ritrovate nella scheda del paese e potete riusarlo per altri clienti. Date e cliente non vengono salvati.
          </p>
          <div>
            <label htmlFor="sp_place" className={labelClass}>
              Paese o regione italiana *
            </label>
            <DestinationSelect id="sp_place" options={options} value={place} onChange={setPlace} />
          </div>
          <div>
            <label htmlFor="sp_title" className={labelClass}>
              Titolo della proposta *
            </label>
            <input id="sp_title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Es. Giordania in 8 giorni con Wadi Rum" />
          </div>
          <div>
            <label htmlFor="sp_desc" className={labelClass}>
              Descrizione breve
            </label>
            <textarea id="sp_desc" rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="A chi è adatto, cosa lo rende speciale…" />
          </div>
          <div>
            <label htmlFor="sp_route" className={labelClass}>
              Percorso (facoltativo)
            </label>
            <input id="sp_route" value={route} maxLength={600} onChange={(e) => setRoute(e.target.value)} className={inputClass} placeholder="Es. Amman (1) → Petra (2) → Wadi Rum (1) → Aqaba (2)" />
            <p className="mt-1 text-xs text-slate-500">Se lo lasci vuoto lo ricavo dagli hotel del viaggio.</p>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60">
              Annulla
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!place || title.trim().length < 2 || saving}
              className="flex items-center gap-1.5 rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Salvo…" : "Salva in Libreria"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
