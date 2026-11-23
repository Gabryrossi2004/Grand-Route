"use client";

import { useState, useTransition } from "react";
import { BookmarkPlus, CalendarPlus, Loader2, Pencil, Trash2 } from "lucide-react";
import SaveAsProposalDialog from "@/components/SaveAsProposalDialog";
import {
  createTripFromAgencyItinerary,
  deleteAgencyItinerary,
  updateAgencyItinerary,
  type AgencyItinerary,
} from "@/lib/actions/agencyItineraries";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]";

// Scheda «Itinerari» della Libreria: gli itinerari dell'agenzia, divisi per paese/regione
export default function AgencyItineraryList({
  items,
  notReady,
  trips,
}: {
  items: AgencyItinerary[];
  notReady: string | null;
  trips: { id: string; title: string; destination: string | null }[];
}) {
  const [picking, setPicking] = useState(false);
  const [tripId, setTripId] = useState("");
  const [dialogTrip, setDialogTrip] = useState<{ id: string; title: string; destination: string | null } | null>(null);

  const groups = new Map<string, { label: string; items: AgencyItinerary[] }>();
  for (const it of items) {
    const id = `${it.kind}:${it.place_key}`;
    if (!groups.has(id)) groups.set(id, { label: it.place_label, items: [] });
    groups.get(id)!.items.push(it);
  }
  const sorted = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "it"));

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-[#e6d7bb] bg-[#faf3e6]/60 p-4 text-sm text-slate-700">
        <p>
          I vostri itinerari, pronti da riusare: compaiono nella <strong>scheda del paese</strong> (o della regione italiana) dell&apos;Atlante e in{" "}
          <strong>«Consulta proposte»</strong> di Zefiro, prima di quelli di Grand Route. Per aggiungerne uno parti da un viaggio già fatto: dal viaggio,
          menu «Altro» → «Salva come proposta in Libreria», oppure da qui.
        </p>
        {notReady ? (
          <p className="mt-2 font-medium text-amber-700">{notReady}</p>
        ) : !picking ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-3 flex items-center gap-1.5 rounded-md bg-[#233c5e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#17283f]"
          >
            <BookmarkPlus size={15} /> Aggiungi un itinerario da un viaggio
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={tripId} onChange={(e) => setTripId(e.target.value)} className={`${inputClass} max-w-md bg-white`}>
              <option value="">Scegli il viaggio…</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.destination ? ` · ${t.destination}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!tripId}
              onClick={() => setDialogTrip(trips.find((t) => t.id === tripId) ?? null)}
              className="rounded-md bg-[#233c5e] px-3 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50"
            >
              Continua
            </button>
            <button type="button" onClick={() => setPicking(false)} className="rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-white">
              Annulla
            </button>
            {trips.length === 0 && <p className="w-full text-xs text-slate-500">Non hai ancora viaggi con un itinerario da salvare.</p>}
          </div>
        )}
      </div>

      {!notReady && items.length === 0 && <p className="text-sm text-slate-500">Non avete ancora salvato itinerari.</p>}

      {sorted.map((g) => (
        <section key={g.label}>
          <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">{g.label}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {g.items.map((it) => (
              <ItineraryCard key={it.id} it={it} />
            ))}
          </div>
        </section>
      ))}

      {dialogTrip && (
        <SaveAsProposalDialog
          tripId={dialogTrip.id}
          tripTitle={dialogTrip.title}
          destination={dialogTrip.destination}
          countries={[]}
          onClose={() => {
            setDialogTrip(null);
            setPicking(false);
            setTripId("");
          }}
        />
      )}
    </div>
  );
}

function ItineraryCard({ it }: { it: AgencyItinerary }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(it.title);
  const [description, setDescription] = useState(it.description ?? "");
  const [route, setRoute] = useState(it.route ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [creating, startCreate] = useTransition();
  const days = [...it.program.days].sort((a, b) => a.day_index - b.day_index);

  if (editing) {
    return (
      <article className="flex flex-col gap-2 rounded-2xl border border-[#cda876] bg-white p-4">
        <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        <input value={route} maxLength={600} onChange={(e) => setRoute(e.target.value)} className={inputClass} placeholder="Percorso" />
        <textarea value={description} rows={3} maxLength={2000} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="Descrizione" />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
            Annulla
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await updateAgencyItinerary({ id: it.id, title, description, route });
                if (!res.ok) setError(res.error);
                else setEditing(false);
              })
            }
            className="rounded-md bg-[#233c5e] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
          >
            {pending ? "Salvo…" : "Salva"}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-1 rounded-2xl border border-[#e6d7bb] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-[#1d2b40]">{it.title}</h4>
        <span className="shrink-0 rounded-full bg-[#233c5e] px-2.5 py-0.5 text-xs font-bold text-white">{it.days} giorni</span>
      </div>
      {it.route && <p className="text-sm font-medium text-[#a87a1e]">{it.route}</p>}
      {it.description && <p className="text-sm text-slate-600">{it.description}</p>}
      <details className="mt-1">
        <summary className="cursor-pointer text-xs font-medium text-emerald-700">Vedi i giorni</summary>
        <ol className="mt-1.5 flex max-h-56 flex-col gap-1 overflow-y-auto text-xs text-slate-700">
          {days.map((d, i) => (
            <li key={i}>
              <span className="font-semibold">Giorno {i + 1}</span>
              {d.title ? ` · ${d.title}` : ""}
              <span className="block text-slate-500">{d.activities.map((a) => a.title).join(" · ")}</span>
            </li>
          ))}
        </ol>
      </details>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={creating}
          onClick={() =>
            startCreate(async () => {
              setError(null);
              const res = await createTripFromAgencyItinerary(it.id);
              if (res?.error) setError(res.error);
            })
          }
          className="flex items-center gap-1.5 rounded-full border border-[#233c5e] px-3 py-1 text-xs font-semibold text-[#233c5e] hover:bg-[#233c5e] hover:text-white disabled:opacity-60"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <CalendarPlus size={13} />}
          {creating ? "Creo il viaggio…" : "Crea il viaggio"}
        </button>
        <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
          <Pencil size={12} /> Modifica
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Eliminare «${it.title}» dalla Libreria?`)) return;
            start(async () => {
              const res = await deleteAgencyItinerary(it.id);
              if (!res.ok) setError(res.error);
            });
          }}
          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          <Trash2 size={12} /> Elimina
        </button>
      </div>
    </article>
  );
}
