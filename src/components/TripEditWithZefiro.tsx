"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import AssistantIcon from "@/components/AssistantIcon";
import { ZefiroThinking } from "@/components/Zefiro";
import { ZEFIRO_ACTION_EVENT } from "@/components/ZefiroFloating";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { applyTripEdits, proposeTripEdits, type EditChange } from "@/lib/actions/tripEdit";

const EXAMPLES = [
  "Sposta le cene alle 20:30",
  "Rendi il giorno 3 più rilassato",
  "Aggiungi una visita al mercato il giorno 2",
  "Togli le attività in più il giorno 4",
];

// "Modifica con Zefiro": si scrive a parole cosa cambiare, Zefiro propone le modifiche precise,
// si scelgono e si applicano. Niente cambia senza conferma.
export default function TripEditWithZefiro({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [summary, setSummary] = useState("");
  const [changes, setChanges] = useState<(EditChange & { keep: boolean })[] | null>(null);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    const onAction = (event: Event) => {
      if ((event as CustomEvent).detail === "trip-edit") {
        setOpen(true);
        setDone(null);
        setChanges(null);
        setQuestions(null);
        setError(null);
      }
    };
    window.addEventListener(ZEFIRO_ACTION_EVENT, onAction);
    return () => window.removeEventListener(ZEFIRO_ACTION_EVENT, onAction);
  }, []);

  function close() {
    if (busy) return;
    setOpen(false);
    if (done) router.refresh();
  }

  async function propose() {
    if (busy || !instruction.trim()) return;
    setBusy(true);
    setError(null);
    setQuestions(null);
    try {
      const result = await proposeTripEdits(tripId, instruction);
      if ("error" in result) setError(result.error);
      else if ("questions" in result) {
        setQuestions(result.questions);
        setSummary(result.summary);
      } else {
        setSummary(result.summary);
        setChanges(result.changes.map((c) => ({ ...c, keep: true })));
      }
    } catch {
      setError("Connessione interrotta. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!changes || busy) return;
    const ops = changes.filter((c) => c.keep).map((c) => c.op);
    if (ops.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await applyTripEdits({ tripId, ops });
      if ("error" in result) setError(result.error);
      else {
        setDone(result.applied);
        router.refresh();
      }
    } catch {
      setError("Connessione interrotta. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const chosen = changes?.filter((c) => c.keep).length ?? 0;

  return (
    <Modal title={`Modifica con ${ASSISTANT_NAME}`} icon={<AssistantIcon size={26} />} onClose={close}>
      {done !== null ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">
            Fatto: {done === 1 ? "1 modifica applicata" : `${done} modifiche applicate`} all&apos;itinerario.
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={close} className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f]">
              Chiudi
            </button>
          </div>
        </div>
      ) : changes ? (
        <div className="flex flex-col gap-3">
          <p className="-mt-2 text-sm text-slate-600">{summary}</p>
          <ul className="flex flex-col gap-2">
            {changes.map((c) => (
              <li key={c.id}>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 ${c.keep ? "border-[#cda876] bg-[#faf3e6]/60" : "border-slate-200 opacity-70"}`}>
                  <input
                    type="checkbox"
                    checked={c.keep}
                    onChange={(e) => setChanges((prev) => prev?.map((x) => (x.id === c.id ? { ...x, keep: e.target.checked } : x)) ?? null)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 text-sm text-slate-800">
                    {c.text}
                    {c.reason && <span className="block text-xs text-slate-500">{c.reason}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {busy && <ZefiroThinking title="Applico le modifiche…" hint="Pochi secondi." />}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setChanges(null)} disabled={busy} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60">
              Indietro
            </button>
            <button type="button" onClick={apply} disabled={busy || chosen === 0} className="rounded-md bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50">
              {chosen === 1 ? "Applica 1 modifica" : `Applica ${chosen} modifiche`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="-mt-2 text-sm text-slate-500">
            Scrivi cosa vuoi cambiare nell&apos;itinerario. {ASSISTANT_NAME} ti mostra le modifiche e le applica solo dopo la tua conferma.
          </p>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Es. Sposta la cena del giorno 3 alle 21:00 e aggiungi un aperitivo prima."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setInstruction(example)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#233c5e] hover:text-[#233c5e]"
              >
                {example}
              </button>
            ))}
          </div>
          {questions && (
            <div className="rounded-lg border border-[#cda876]/60 bg-[#faf3e6]/70 p-3 text-sm text-slate-800">
              <p className="mb-1 font-medium">{ASSISTANT_NAME} ha bisogno di un chiarimento:</p>
              <ul className="list-disc pl-5">
                {questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-slate-500">Aggiungi la risposta nella richiesta qui sopra e riprova.</p>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {busy && <ZefiroThinking title={`${ASSISTANT_NAME} sta leggendo l'itinerario…`} hint="Prepara le modifiche: pochi secondi." />}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} disabled={busy} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60">
              Annulla
            </button>
            <button type="button" onClick={propose} disabled={busy || !instruction.trim()} className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60">
              {busy ? "Un momento…" : "Proponi le modifiche"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
