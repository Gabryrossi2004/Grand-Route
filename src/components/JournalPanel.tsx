"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { addJournalEntry, deleteJournalEntry, listJournal, type JournalEntry } from "@/lib/actions/clientJournal";
import type { BoardTrip } from "@/components/CountryBoard";

const today = () => new Date().toISOString().slice(0, 10);
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Il diario di un paese: note private con data e luogo
export default function JournalPanel({ country, trips, onCountChange }: { country: string; trips: BoardTrip[]; onCountChange: (n: number) => void }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(today());
  const [tripId, setTripId] = useState(trips.length === 1 ? trips[0].id : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    listJournal(country).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setEntries(res.entries);
        onCountChange(res.entries.length);
      } else {
        setError(res.error);
        setEntries([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [country, onCountChange]);

  async function reload() {
    const res = await listJournal(country);
    if (res.ok) {
      setEntries(res.entries);
      onCountChange(res.entries.length);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await addJournalEntry({ country, place: place.trim() || null, tripId: tripId || null, entryDate: date || today(), body });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBody("");
    await reload();
  }

  async function remove(id: string) {
    if (!window.confirm("Eliminare questa nota?")) return;
    const res = await deleteJournalEntry(id);
    if (!res.ok) setError(res.error);
    else await reload();
  }

  const tripTitle = (id: string | null) => trips.find((t) => t.id === id)?.title;
  const field = "rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-sm outline-none focus:border-[#c58f2d]";

  return (
    <div>
      <form onSubmit={save} className="mb-5 flex flex-col gap-2 rounded-2xl border border-[#e6d7bb] bg-white p-3">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={4000} placeholder="Cosa hai visto, mangiato, provato oggi? Scrivi i tuoi ricordi…" className={`${field} resize-y`} />
        <div className="flex flex-wrap items-center gap-2">
          <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="Luogo (es. Bangkok)" className={`${field} min-w-0 flex-1`} />
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Giorno" className={field} />
          {trips.length > 1 && (
            <select value={tripId} onChange={(e) => setTripId(e.target.value)} aria-label="Viaggio" className={field}>
              <option value="">Nessun viaggio in particolare</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
          <button type="submit" disabled={saving || !body.trim()} className="rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3050] disabled:opacity-60">
            {saving ? "Salvo…" : "Aggiungi al diario"}
          </button>
        </div>
      </form>
      {error && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}

      {entries === null ? (
        <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Carico il diario…
        </p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-6 text-center text-sm text-slate-600">
          Il tuo diario di questo paese è ancora vuoto. Le note sono private: le vedi solo tu.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((en) => (
            <li key={en.id} className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">
                  {longDate(en.entryDate)}
                  {en.place && <span className="text-slate-600"> · {en.place}</span>}
                  {tripTitle(en.tripId) && <span className="font-normal normal-case text-slate-500"> · {tripTitle(en.tripId)}</span>}
                </p>
                <button type="button" onClick={() => remove(en.id)} aria-label="Elimina la nota" className="text-slate-400 hover:text-red-600">
                  <Trash2 size={15} />
                </button>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">{en.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
