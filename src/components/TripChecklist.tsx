"use client";

import { useState } from "react";
import { CheckSquare, ChevronDown, ListChecks, Square, Trash2 } from "lucide-react";
import type { TripChecklistItem } from "@/lib/types";
import { addChecklistItem, deleteChecklistItem, toggleChecklistItem } from "@/app/dashboard/trips/[id]/actions";

export default function TripChecklist({ tripId, items: initialItems }: { tripId: string; items: TripChecklistItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sorted = [...items].sort((a, b) => a.item_order - b.item_order);
  const pending = sorted.filter((item) => !item.done).length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || submitting) return;
    setLabel("");
    setSubmitting(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticItem: TripChecklistItem = {
      id: tempId,
      trip_id: tripId,
      label: trimmed,
      done: false,
      item_order: items.length,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, optimisticItem]);

    const formData = new FormData();
    formData.set("label", trimmed);
    const created = await addChecklistItem(tripId, formData);
    setItems((prev) => prev.map((item) => (item.id === tempId ? (created ?? item) : item)));
    setSubmitting(false);
  }

  function handleToggle(item: TripChecklistItem) {
    if (item.id.startsWith("temp-")) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    toggleChecklistItem(tripId, item.id, !item.done);
  }

  function handleDelete(item: TripChecklistItem) {
    if (item.id.startsWith("temp-")) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    deleteChecklistItem(tripId, item.id);
  }

  return (
    <details className="group/panel min-w-[280px] flex-1 overflow-hidden rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ee] shadow-sm">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-6 py-4 text-sm font-semibold uppercase tracking-wide text-slate-500 marker:content-none">
        <span className="flex items-center gap-2">
          <ListChecks size={15} className="text-slate-400" />
          Promemoria
          {pending > 0 && (
            <span className="rounded-full bg-[#233c5e] px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-white">
              {pending}
            </span>
          )}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open/panel:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 px-6 pb-6 pt-4">
      <p className="mb-3 text-sm text-slate-500">
        Una checklist privata, visibile solo a te: non appare mai sulla pagina del cliente.
      </p>

      {sorted.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">Nessun promemoria ancora.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
            >
              <button
                type="button"
                onClick={() => handleToggle(item)}
                title={item.done ? "Segna come da fare" : "Segna come fatto"}
                className="flex shrink-0 items-center text-slate-400 transition hover:text-[#233c5e] disabled:opacity-40"
                disabled={item.id.startsWith("temp-")}
              >
                {item.done ? <CheckSquare size={18} className="text-green-600" /> : <Square size={18} />}
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  item.done ? "text-slate-400 line-through" : "text-slate-700"
                }`}
              >
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(item)}
                title="Elimina promemoria"
                className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-0"
                disabled={item.id.startsWith("temp-")}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 border-t border-slate-100 pt-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          type="text"
          placeholder="Nuovo promemoria (es. Richiedere saldo)"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
        />
        <button
          type="submit"
          disabled={submitting}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          + Aggiungi
        </button>
      </form>
      </div>
    </details>
  );
}
