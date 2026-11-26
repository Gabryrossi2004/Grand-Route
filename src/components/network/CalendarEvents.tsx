"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Plus, StickyNote, Trash2 } from "lucide-react";
import { addCalendarEvent, deleteCalendarEvent } from "@/lib/actions/agenda";
import { dayLabel } from "@/lib/network/agenda";

export type CalEvent = { id: string; kind: "non_disponibile" | "nota"; title: string; day_from: string; day_to: string };

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";
const range = (e: CalEvent) =>
  e.day_from === e.day_to ? dayLabel(e.day_from, { weekday: "short", day: "numeric", month: "long" }) : `${dayLabel(e.day_from, { day: "numeric", month: "long" })} – ${dayLabel(e.day_to, { day: "numeric", month: "long" })}`;

// I tuoi impegni nel calendario: giorni in cui non sei disponibile e note. Sono privati: li vedi solo tu.
export default function CalendarEvents({ events, today }: { events: CalEvent[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CalEvent["kind"]>("non_disponibile");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(null);
      const r = await addCalendarEvent({ kind, title, from, to: to < from ? from : to });
      if (!r.ok) return setError(r.error);
      setTitle("");
      setOpen(false);
      router.refresh();
    });
  const remove = (id: string) =>
    start(async () => {
      const r = await deleteCalendarEvent(id);
      setAskDelete(null);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });

  return (
    <section className="mt-3 rounded-2xl border border-[#e6d7bb] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-[#233c5e]">I tuoi impegni</p>
          <p className="text-sm text-slate-600">Segna i giorni in cui non lavori e le note: restano nel calendario e li vedi solo tu.</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e6d7bb] px-4 text-sm font-semibold text-[#233c5e] hover:bg-[#faf3e6]">
          <Plus size={16} /> {open ? "Chiudi" : "Aggiungi"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl bg-[#faf7ee] p-3">
          <div className="flex gap-2" role="radiogroup" aria-label="Tipo di impegno">
            {([
              ["non_disponibile", "Non disponibile", CalendarOff],
              ["nota", "Nota", StickyNote],
            ] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} data-nofx className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold ${kind === k ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e]"}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium text-slate-700">
              Dal
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} className={`${field} mt-1`} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Al (compreso)
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1`} />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            {kind === "nota" ? "Nota" : "Motivo (facoltativo)"}
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={kind === "nota" ? "Es. rinnovo assicurazione" : "Es. ferie, altro lavoro, giorno di riposo"} className={`${field} mt-1`} />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="button" disabled={pending} onClick={save} className="inline-flex min-h-11 items-center rounded-xl bg-[#233c5e] px-5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60">Salva nel calendario</button>
        </div>
      )}

      {events.length > 0 && (
        <ul className="mt-3 divide-y divide-[#f2e2c4]">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${e.kind === "nota" ? "bg-sky-100 text-sky-800" : "bg-slate-200 text-slate-700"}`}>
                  {e.kind === "nota" ? <StickyNote size={14} /> : <CalendarOff size={14} />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{e.kind === "nota" ? e.title : e.title || "Non disponibile"}</p>
                  <p className="text-xs capitalize text-slate-500">{range(e)}</p>
                </div>
              </div>
              {askDelete === e.id ? (
                <span className="flex items-center gap-2 text-sm">
                  Eliminare?
                  <button type="button" disabled={pending} onClick={() => remove(e.id)} className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white">Sì</button>
                  <button type="button" onClick={() => setAskDelete(null)} className="px-2 text-slate-600">No</button>
                </span>
              ) : (
                <button type="button" onClick={() => setAskDelete(e.id)} aria-label={`Elimina: ${e.title || "non disponibile"}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
