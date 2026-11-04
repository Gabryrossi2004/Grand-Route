import { CheckSquare, ListChecks, Square, Trash2 } from "lucide-react";
import type { TripChecklistItem } from "@/lib/types";
import { addChecklistItem, deleteChecklistItem, toggleChecklistItem } from "@/app/dashboard/trips/[id]/actions";

export default function TripChecklist({ tripId, items }: { tripId: string; items: TripChecklistItem[] }) {
  const sorted = [...items].sort((a, b) => a.item_order - b.item_order);
  const pending = sorted.filter((item) => !item.done).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks size={18} className="text-slate-400" />
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Promemoria</h2>
          <p className="text-sm text-slate-500">
            Una checklist privata, visibile solo a te: non appare mai sulla pagina del cliente.
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">Nessun promemoria ancora.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
            >
              <form action={toggleChecklistItem.bind(null, tripId, item.id, !item.done)}>
                <button
                  type="submit"
                  title={item.done ? "Segna come da fare" : "Segna come fatto"}
                  className="flex shrink-0 items-center text-slate-400 transition hover:text-blue-600"
                >
                  {item.done ? <CheckSquare size={18} className="text-green-600" /> : <Square size={18} />}
                </button>
              </form>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  item.done ? "text-slate-400 line-through" : "text-slate-700"
                }`}
              >
                {item.label}
              </span>
              <form action={deleteChecklistItem.bind(null, tripId, item.id)}>
                <button
                  type="submit"
                  title="Elimina promemoria"
                  className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {pending > 0 && <p className="mb-2 text-xs text-slate-400">{pending} promemoria da fare</p>}

      <form action={addChecklistItem.bind(null, tripId)} className="flex gap-2 border-t border-slate-100 pt-3">
        <input
          name="label"
          type="text"
          placeholder="Nuovo promemoria (es. Richiedere saldo)"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          + Aggiungi
        </button>
      </form>
    </section>
  );
}
