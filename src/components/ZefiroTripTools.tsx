"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import AssistantIcon from "@/components/AssistantIcon";
import { ZefiroThinking } from "@/components/Zefiro";
import { ZEFIRO_ACTION_EVENT } from "@/components/ZefiroFloating";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { activityTypes } from "@/lib/activityTypes";
import type { PromptStyle } from "@/lib/types";
import type { Suggestion } from "@/lib/tripToolsAi";
import {
  applyChecklist,
  applyDescriptions,
  applySuggestions,
  proposeChecklist,
  proposeDescriptions,
  proposeSuggestions,
  type DescribeProposal,
} from "@/lib/actions/zefiroTools";

type Tool = "describe" | "checklist" | "suggest" | null;

const btnPrimary = "rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-50";
const btnGhost = "rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60";
const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";

// Tre strumenti di Zefiro dentro il viaggio: completa le descrizioni, checklist, suggerisci attività.
// Si aprono dal personaggio o dal menu «Zefiro» dell'itinerario.
export default function ZefiroTripTools({
  tripId,
  mode,
  days,
  promptStyles,
  missingDescriptions,
}: {
  tripId: string;
  mode: "activities" | "days";
  days: { id: string; label: string }[];
  promptStyles: PromptStyle[];
  missingDescriptions: number;
}) {
  const [tool, setTool] = useState<Tool>(null);

  useEffect(() => {
    const onAction = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d === "trip-describe") setTool("describe");
      else if (d === "trip-checklist") setTool("checklist");
      else if (d === "trip-suggest") setTool("suggest");
    };
    window.addEventListener(ZEFIRO_ACTION_EVENT, onAction);
    return () => window.removeEventListener(ZEFIRO_ACTION_EVENT, onAction);
  }, []);

  if (!tool) return null;
  const close = () => setTool(null);
  if (tool === "describe") return <DescribeModal tripId={tripId} mode={mode} promptStyles={promptStyles} missing={missingDescriptions} onClose={close} />;
  if (tool === "checklist") return <ChecklistModal tripId={tripId} onClose={close} />;
  return <SuggestModal tripId={tripId} mode={mode} days={days} promptStyles={promptStyles} onClose={close} />;
}

function StyleSelect({ promptStyles, value, onChange }: { promptStyles: PromptStyle[]; value: string; onChange: (v: string) => void }) {
  if (promptStyles.length === 0) return null;
  return (
    <div>
      <label htmlFor="zt_style" className="mb-1 block text-sm font-medium text-slate-700">
        Stile di scrittura (opzionale)
      </label>
      <select id="zt_style" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Nessuno in particolare</option>
        {promptStyles.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Completa le descrizioni ──────────────────────────────────────────────

function DescribeModal({ tripId, mode, promptStyles, missing, onClose }: { tripId: string; mode: "activities" | "days"; promptStyles: PromptStyle[]; missing: number; onClose: () => void }) {
  const router = useRouter();
  const [style, setStyle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<(DescribeProposal & { keep: boolean })[] | null>(null);
  const [capped, setCapped] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await proposeDescriptions(tripId, style || null);
      if ("error" in r) setError(r.error);
      else {
        setItems(r.items.map((i) => ({ ...i, keep: true })));
        setCapped(r.capped);
      }
    } catch {
      setError("Connessione interrotta. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const chosen = (items ?? []).filter((i) => i.keep).map((i) => ({ id: i.id, description: i.description }));
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await applyDescriptions(tripId, chosen);
      if ("error" in r) setError(r.error);
      else {
        setDone(r.applied);
        router.refresh();
      }
    } catch {
      setError("Connessione interrotta. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const chosenCount = items?.filter((i) => i.keep).length ?? 0;
  return (
    <Modal title="Completa le descrizioni" icon={<AssistantIcon size={26} />} onClose={() => !busy && onClose()}>
      {done !== null ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">Fatto: {done === 1 ? "1 descrizione aggiunta" : `${done} descrizioni aggiunte`}.</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={btnPrimary}>
              Chiudi
            </button>
          </div>
        </div>
      ) : items ? (
        <div className="flex flex-col gap-3">
          <p className="-mt-2 text-sm text-slate-500">Controlla le descrizioni e togli la spunta a quelle che non vuoi. Potrai sempre modificarle.</p>
          {capped && <p className="text-xs text-amber-700">Ho scritto le prime 60 attività: per le altre ripeti l&apos;operazione.</p>}
          <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1">
            {items.map((i) => (
              <li key={i.id}>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 ${i.keep ? "border-[#cda876] bg-[#faf3e6]/60" : "border-slate-200 opacity-70"}`}>
                  <input type="checkbox" checked={i.keep} onChange={(e) => setItems((prev) => prev?.map((x) => (x.id === i.id ? { ...x, keep: e.target.checked } : x)) ?? null)} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="min-w-0 text-sm text-slate-800">
                    <span className="block text-xs font-semibold text-slate-500">
                      Giorno {i.day} · {i.title}
                    </span>
                    {i.description}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {busy && <ZefiroThinking title="Salvo le descrizioni…" hint="Pochi secondi." />}
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setItems(null)} disabled={busy} className={btnGhost}>
              Indietro
            </button>
            <button type="button" onClick={apply} disabled={busy || chosenCount === 0} className={btnPrimary}>
              {chosenCount === 1 ? "Aggiungi 1 descrizione" : `Aggiungi ${chosenCount} descrizioni`}
            </button>
          </div>
        </div>
      ) : mode === "days" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">Questo viaggio è organizzato per giornata intera: il programma di ogni giorno è già un unico blocco di testo, non ci sono descrizioni singole da completare.</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={btnPrimary}>
              Chiudi
            </button>
          </div>
        </div>
      ) : missing === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">Tutte le attività di questo viaggio hanno già una descrizione.</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={btnPrimary}>
              Chiudi
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="-mt-2 text-sm text-slate-500">
            {ASSISTANT_NAME} scrive la descrizione delle <strong>{missing}</strong> attività che ancora non ne hanno una, nel tuo stile. Non inventa prezzi, orari di apertura o nomi di locali.
          </p>
          <StyleSelect promptStyles={promptStyles} value={style} onChange={setStyle} />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {busy && <ZefiroThinking title={`${ASSISTANT_NAME} sta scrivendo…`} hint="Può richiedere un po': circa mezzo minuto." />}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className={btnGhost}>
              Annulla
            </button>
            <button type="button" onClick={run} disabled={busy} className={btnPrimary}>
              {busy ? "Un momento…" : "Scrivi le descrizioni"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Checklist ────────────────────────────────────────────────────────────

function ChecklistModal({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<{ label: string; keep: boolean }[] | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await proposeChecklist(tripId);
      if ("error" in r) setError(r.error);
      else setItems(r.items.map((label) => ({ label, keep: true })));
    } catch {
      setError("Connessione interrotta. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const chosen = (items ?? []).filter((i) => i.keep).map((i) => i.label);
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await applyChecklist(tripId, chosen);
      if ("error" in r) setError(r.error);
      else {
        setDone(r.added);
        router.refresh();
      }
    } catch {
      setError("Connessione interrotta. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const chosenCount = items?.filter((i) => i.keep).length ?? 0;
  return (
    <Modal title="Checklist del viaggio" icon={<AssistantIcon size={26} />} onClose={() => !busy && onClose()}>
      {done !== null ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">Fatto: {done === 1 ? "1 voce aggiunta" : `${done} voci aggiunte`} ai promemoria del viaggio.</p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={btnPrimary}>
              Chiudi
            </button>
          </div>
        </div>
      ) : items ? (
        <div className="flex flex-col gap-3">
          <p className="-mt-2 text-sm text-slate-500">Togli la spunta alle voci che non servono: le altre si aggiungono ai promemoria del viaggio.</p>
          <ul className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {items.map((i, index) => (
              <li key={index}>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 ${i.keep ? "border-[#cda876] bg-[#faf3e6]/60" : "border-slate-200 opacity-70"}`}>
                  <input type="checkbox" checked={i.keep} onChange={(e) => setItems((prev) => prev?.map((x, j) => (j === index ? { ...x, keep: e.target.checked } : x)) ?? null)} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-sm text-slate-800">{i.label}</span>
                </label>
              </li>
            ))}
          </ul>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setItems(null)} disabled={busy} className={btnGhost}>
              Indietro
            </button>
            <button type="button" onClick={apply} disabled={busy || chosenCount === 0} className={btnPrimary}>
              {busy ? "Aggiungo…" : chosenCount === 1 ? "Aggiungi 1 voce" : `Aggiungi ${chosenCount} voci`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="-mt-2 text-sm text-slate-500">
            {ASSISTANT_NAME} legge l&apos;itinerario e prepara i promemoria da spuntare prima della partenza: documenti, prenotazioni, assicurazione, informazioni da dare al cliente e preparazione pratica. Per visti e requisiti ti ricorda di verificarli, senza citare regole.
          </p>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {busy && <ZefiroThinking title={`${ASSISTANT_NAME} sta preparando la checklist…`} hint="Pochi secondi." />}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className={btnGhost}>
              Annulla
            </button>
            <button type="button" onClick={run} disabled={busy} className={btnPrimary}>
              {busy ? "Un momento…" : "Prepara la checklist"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Suggerisci attività ──────────────────────────────────────────────────

function SuggestModal({ tripId, mode, days, promptStyles, onClose }: { tripId: string; mode: "activities" | "days"; days: { id: string; label: string }[]; promptStyles: PromptStyle[]; onClose: () => void }) {
  const router = useRouter();
  const [dayId, setDayId] = useState(days[0]?.id ?? "");
  const [preference, setPreference] = useState("");
  const [style, setStyle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<(Suggestion & { keep: boolean })[] | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function run() {
    if (!dayId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await proposeSuggestions(tripId, dayId, preference, style || null);
      if ("error" in r) setError(r.error);
      else setItems(r.suggestions.map((s) => ({ ...s, keep: false })));
    } catch {
      setError("Connessione interrotta. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const chosen = (items ?? []).filter((i) => i.keep).map(({ keep: _keep, ...s }) => s);
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await applySuggestions(tripId, dayId, chosen);
      if ("error" in r) setError(r.error);
      else {
        setDone(r.added);
        router.refresh();
      }
    } catch {
      setError("Connessione interrotta. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const chosenCount = items?.filter((i) => i.keep).length ?? 0;
  const dayLabel = days.find((d) => d.id === dayId)?.label ?? "";
  return (
    <Modal title="Suggerisci attività" icon={<AssistantIcon size={26} />} onClose={() => !busy && onClose()}>
      {days.length === 0 ? (
        <p className="text-sm text-slate-700">Aggiungi prima almeno un giorno all&apos;itinerario.</p>
      ) : done !== null ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">
            Fatto: {done === 1 ? "1 attività aggiunta" : `${done} attività aggiunte`} a «{dayLabel}».
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={btnPrimary}>
              Chiudi
            </button>
          </div>
        </div>
      ) : items ? (
        <div className="flex flex-col gap-3">
          <p className="-mt-2 text-sm text-slate-500">Scegli quelle che vuoi aggiungere a «{dayLabel}».</p>
          <ul className="flex flex-col gap-2">
            {items.map((s, index) => {
              const meta = activityTypes[s.activity_type];
              return (
                <li key={index}>
                  <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 ${s.keep ? "border-[#cda876] bg-[#faf3e6]/60" : "border-slate-200"}`}>
                    <input type="checkbox" checked={s.keep} onChange={(e) => setItems((prev) => prev?.map((x, j) => (j === index ? { ...x, keep: e.target.checked } : x)) ?? null)} className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 text-sm text-slate-800">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong>
                          {s.start_time ? `${s.start_time} ` : ""}
                          {s.title}
                        </strong>
                        <span style={{ color: meta.color, borderColor: meta.color }} className="rounded-full border px-1.5 text-[11px] font-medium">
                          {meta.label}
                        </span>
                      </span>
                      {s.location && <span className="block text-xs text-slate-500">{s.location}</span>}
                      <span className="block">{s.description}</span>
                      <span className="block text-xs italic text-slate-500">{s.why}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {mode === "days" && <p className="text-xs text-slate-500">In questo viaggio le attività scelte vengono aggiunte come righe dell&apos;elenco del giorno.</p>}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setItems(null)} disabled={busy} className={btnGhost}>
              Indietro
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={run} disabled={busy} className={btnGhost}>
                Altre idee
              </button>
              <button type="button" onClick={apply} disabled={busy || chosenCount === 0} className={btnPrimary}>
                {busy ? "Aggiungo…" : chosenCount === 1 ? "Aggiungi 1 attività" : `Aggiungi ${chosenCount} attività`}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="-mt-2 text-sm text-slate-500">
            {ASSISTANT_NAME} guarda cosa c&apos;è già in quel giorno e propone 4 attività che si inseriscono bene: scegli quali aggiungere.
          </p>
          <div>
            <label htmlFor="zt_day" className="mb-1 block text-sm font-medium text-slate-700">
              Per quale giorno?
            </label>
            <select id="zt_day" value={dayId} onChange={(e) => setDayId(e.target.value)} className={inputClass}>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="zt_pref" className="mb-1 block text-sm font-medium text-slate-700">
              Che cosa cerchi? (opzionale)
            </label>
            <input id="zt_pref" value={preference} onChange={(e) => setPreference(e.target.value)} placeholder="Es. qualcosa per la sera, con bambini, all'aperto…" className={inputClass} />
          </div>
          <StyleSelect promptStyles={promptStyles} value={style} onChange={setStyle} />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {busy && <ZefiroThinking title={`${ASSISTANT_NAME} sta pensando alle idee…`} hint="Pochi secondi." />}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className={btnGhost}>
              Annulla
            </button>
            <button type="button" onClick={run} disabled={busy || !dayId} className={btnPrimary}>
              {busy ? "Un momento…" : "Suggerisci"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
