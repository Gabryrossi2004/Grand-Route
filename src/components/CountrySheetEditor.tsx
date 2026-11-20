"use client";

import { Plus, Trash2 } from "lucide-react";
import type { CountrySheetContent } from "@/lib/countrySheetAi";

const FACTS: { key: keyof CountrySheetContent["facts"]; label: string }[] = [
  { key: "capital", label: "Capitale" },
  { key: "languages", label: "Lingue" },
  { key: "currency", label: "Moneta" },
  { key: "timezone", label: "Fuso orario" },
  { key: "flight", label: "Volo dall'Italia" },
  { key: "bestPeriod", label: "Periodo migliore" },
  { key: "climate", label: "Clima" },
  { key: "plugs", label: "Prese elettriche" },
  { key: "driving", label: "Guida" },
  { key: "documents", label: "Documenti" },
];

const input = "w-full rounded-lg border border-[#e6d7bb] bg-white px-2.5 py-1.5 text-sm text-slate-800";
const lines = (items: string[]) => items.join("\n");
const toItems = (text: string) => text.split("\n").map((s) => s.trim()).filter(Boolean);

// Modifica a mano di tutti i testi della scheda paese
export default function CountrySheetEditor({ draft, onChange }: { draft: CountrySheetContent; onChange: (next: CountrySheetContent) => void }) {
  const set = (patch: Partial<CountrySheetContent>) => onChange({ ...draft, ...patch });

  return (
    <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="flex flex-col gap-4">
        <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">Scheda tecnica</h3>
          <div className="flex flex-col gap-2">
            {FACTS.map((f) => (
              <label key={f.key} className="text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">
                {f.label}
                <textarea
                  value={draft.facts[f.key]}
                  onChange={(e) => set({ facts: { ...draft.facts, [f.key]: e.target.value } })}
                  rows={2}
                  className={`${input} mt-0.5 font-normal normal-case tracking-normal`}
                />
              </label>
            ))}
          </div>
        </div>
        <ListField title="Come muoversi" value={draft.gettingAround} onChange={(v) => set({ gettingAround: v })} />
        <ListField title="Da assaggiare" value={draft.food} onChange={(v) => set({ food: v })} />
        <ListField title="Consigli pratici" value={draft.tips} onChange={(v) => set({ tips: v })} />
        <ListField title="Consigli per l'agente" value={draft.agentTips ?? []} onChange={(v) => set({ agentTips: v })} />
      </section>

      <section className="flex flex-col gap-4">
        <label className="text-sm font-semibold text-[#233c5e]">
          Frase iniziale
          <input value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} className={`${input} mt-1 font-normal`} />
        </label>
        <div>
          <p className="mb-1 text-sm font-semibold text-[#233c5e]">Descrizione</p>
          <div className="flex flex-col gap-2">
            {draft.description.map((para, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  value={para}
                  onChange={(e) => set({ description: draft.description.map((p, j) => (j === i ? e.target.value : p)) })}
                  rows={4}
                  className={`${input} text-[15px] leading-relaxed`}
                />
                <button
                  type="button"
                  aria-label="Togli il paragrafo"
                  onClick={() => set({ description: draft.description.filter((_, j) => j !== i) })}
                  className="self-start rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set({ description: [...draft.description, ""] })}
              className="flex w-fit items-center gap-1.5 rounded-full border border-dashed border-[#c58f2d] px-3 py-1 text-sm text-[#233c5e]"
            >
              <Plus size={14} /> Aggiungi un paragrafo
            </button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold text-[#233c5e]">Posti da visitare</p>
          <div className="flex flex-col gap-2">
            {draft.places.map((pl, i) => (
              <div key={i} className="flex gap-2 rounded-xl border border-[#e6d7bb] bg-white p-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <input
                    value={pl.name}
                    onChange={(e) => set({ places: draft.places.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)) })}
                    placeholder="Nome del luogo"
                    className={`${input} font-semibold`}
                  />
                  <textarea
                    value={pl.description}
                    onChange={(e) => set({ places: draft.places.map((p, j) => (j === i ? { ...p, description: e.target.value } : p)) })}
                    rows={2}
                    placeholder="Cosa si vede o si fa"
                    className={input}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Togli il luogo"
                  onClick={() => set({ places: draft.places.filter((_, j) => j !== i) })}
                  className="self-start rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set({ places: [...draft.places, { name: "", description: "", search: "" }] })}
              className="flex w-fit items-center gap-1.5 rounded-full border border-dashed border-[#c58f2d] px-3 py-1 text-sm text-[#233c5e]"
            >
              <Plus size={14} /> Aggiungi un luogo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ListField({ title, value, onChange }: { title: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <label className="block">
      <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">{title}</span>
      <span className="block text-xs text-slate-500">Una voce per riga</span>
      <textarea defaultValue={lines(value)} onBlur={(e) => onChange(toItems(e.target.value))} rows={Math.max(3, value.length + 1)} className={`${input} mt-1`} />
    </label>
  );
}
