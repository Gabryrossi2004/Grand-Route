"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { addPackingItems, deletePackingItem, resetPackingChecks, togglePackingItem } from "@/app/viaggiatore/tripActions";
import { PACK_CATEGORIES, TRIP_KINDS, baseList, kindList } from "@/lib/packing";

export type PackRow = { id: string; text: string; category: string; done: boolean; item_order: number };
type Country = { name: string; plugs: string; documents: string; currency: string; timezone: string };

const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";

export default function PackingList({
  tripId,
  days,
  initial,
  notReady,
  country,
}: {
  tripId: string;
  days: number;
  initial: PackRow[];
  notReady: boolean;
  country: Country | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<PackRow[]>(initial);
  const [kinds, setKinds] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState(PACK_CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // gli elementi nuovi compaiono dopo il ricaricamento dei dati
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setItems(initial);
  }

  if (notReady) {
    return <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per usare la valigia serve l&apos;aggiornamento del database (migrazione 0059, Supabase → SQL Editor).</p>;
  }

  const done = items.filter((i) => i.done).length;
  const byCategory = new Map<string, PackRow[]>();
  for (const it of items) byCategory.set(it.category, [...(byCategory.get(it.category) ?? []), it]);
  const categories = [...PACK_CATEGORIES.filter((c) => byCategory.has(c)), ...[...byCategory.keys()].filter((c) => !PACK_CATEGORIES.includes(c))];

  function add(list: { text: string; category: string }[]) {
    setError(null);
    start(async () => {
      const res = await addPackingItems(tripId, list);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function toggle(it: PackRow) {
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
    togglePackingItem(tripId, it.id, !it.done).then((res) => {
      if (!res.ok) {
        setError(res.error);
        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, done: it.done } : x)));
      }
    });
  }
  function remove(it: PackRow) {
    setItems((prev) => prev.filter((x) => x.id !== it.id));
    deletePackingItem(tripId, it.id).then((res) => {
      if (!res.ok) {
        setError(res.error);
        router.refresh();
      }
    });
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    add([{ text: text.trim(), category }]);
    setText("");
  }

  return (
    <div className="flex flex-col gap-5">
      {country && (
        <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4 text-sm text-slate-700">
          <h2 className="mb-2 font-semibold text-[#233c5e]">Da sapere per {country.name}</h2>
          <ul className="flex flex-col gap-1.5">
            <li>
              <strong>Prese:</strong> {country.plugs}
            </li>
            <li>
              <strong>Documenti:</strong> {country.documents}
            </li>
            <li>
              <strong>Moneta:</strong> {country.currency}. <strong>Fuso:</strong> {country.timezone}
            </li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">Informazioni generali della libreria Grand Route: controlla sempre le regole aggiornate su viaggiaresicuri.it.</p>
        </section>
      )}

      <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-[#233c5e]">
          <Wand2 size={16} className="text-[#c58f2d]" /> Idee per la valigia
        </h2>
        <p className="mb-3 text-sm text-slate-600">Che viaggio è? Scegli e aggiungo le cose utili (puoi toglierle dopo). Le quantità seguono i {days} giorni del viaggio.</p>
        <div className="flex flex-wrap gap-1.5">
          {TRIP_KINDS.map((k) => {
            const on = kinds.includes(k.id);
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKinds((prev) => (on ? prev.filter((x) => x !== k.id) : [...prev, k.id]))}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-sm transition ${on ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e] hover:bg-[#faf3e6]"}`}
              >
                {k.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => add([...baseList(days), ...kinds.flatMap((k) => kindList(k, days))])}
            className="rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60"
          >
            {items.length === 0 ? "Crea la lista" : "Aggiungi le idee alla lista"}
          </button>
        </div>
      </section>

      {items.length > 0 && (
        <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">
              Preparato: <strong>{done}</strong> su {items.length}
            </p>
            {done > 0 && (
              <button
                type="button"
                onClick={() => {
                  setItems((prev) => prev.map((x) => ({ ...x, done: false })));
                  resetPackingChecks(tripId);
                }}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#233c5e]"
              >
                <RotateCcw size={12} /> Togli tutte le spunte
              </button>
            )}
          </div>
          <div className="mb-4 h-2 rounded-full bg-[#f1ead9]">
            <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
          <div className="flex flex-col gap-4">
            {categories.map((c) => (
              <div key={c}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">{c}</h3>
                <ul className="flex flex-col">
                  {byCategory.get(c)!.map((it) => (
                    <li key={it.id} className="group flex items-center gap-2 border-b border-[#f4ecdb] py-1.5 last:border-0">
                      <button
                        type="button"
                        onClick={() => toggle(it)}
                        aria-label={it.done ? `Togli la spunta a ${it.text}` : `Spunta ${it.text}`}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${it.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}
                      >
                        {it.done && <Check size={13} />}
                      </button>
                      <span className={`min-w-0 flex-1 text-sm ${it.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{it.text}</span>
                      <button type="button" onClick={() => remove(it)} aria-label={`Elimina ${it.text}`} className="text-slate-300 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={submit} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e6d7bb] bg-white p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="Aggiungi una cosa (es. Binocolo)" className={`${field} min-w-0 flex-1`} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria" className={field}>
          {PACK_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button type="submit" disabled={pending || !text.trim()} className="flex items-center gap-1 rounded-full border border-[#233c5e] px-4 py-2 text-sm font-semibold text-[#233c5e] hover:bg-[#233c5e] hover:text-white disabled:opacity-50">
          <Plus size={14} /> Aggiungi
        </button>
      </form>
      {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}
    </div>
  );
}
