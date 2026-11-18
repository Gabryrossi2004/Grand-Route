"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Sparkles } from "lucide-react";
import type { Client } from "@/lib/types";
import type { GeneratedItinerary } from "@/lib/itineraryAi";
import Modal from "@/components/Modal";
import DateField from "@/components/DateField";
import DropzoneUpload from "@/components/DropzoneUpload";
import AiQuestions, { formatClarifications } from "@/components/AiQuestions";
import AssistantIcon from "@/components/AssistantIcon";
import { ZefiroThinking } from "@/components/Zefiro";
import { ZEFIRO_ACTION_EVENT } from "@/components/ZefiroFloating";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { createTripFromProposals, generateProposal, planTripWithZefiro, type PlanOk } from "./zefiroActions";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const EXAMPLE =
  "Voglio un viaggio per un gruppo di 3 amici sui 20 anni, vorrebbero andare in Messico e sono interessati sia alla parte culturale che alla vita notturna. La durata del viaggio è di 10 giorni, vogliono dormire in hotel, hanno auto a noleggio (considera non più di 4 ore di macchina per gli spostamenti maggiori).";

type Proposal = {
  name: string;
  route: string;
  summary: string;
  status: "loading" | "ready" | "error";
  itinerary?: GeneratedItinerary;
  error?: string;
  keep: boolean;
};

function isRedirect(error: unknown) {
  return Boolean(error && typeof error === "object" && "digest" in error && String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT"));
}

// "Genera con Zefiro": si descrive il viaggio a grandi linee (o nel dettaglio) e Zefiro prepara
// una proposta, oppure tre se la richiesta è generica. Si scelgono quelle da tenere (le altre
// diventano varianti dello stesso viaggio) e si crea tutto in un colpo.
export default function GenerateWithZefiro({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"brief" | "questions" | "review">("brief");
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanOk | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const lastForm = useRef<FormData | null>(null);

  // Si apre dal pulsante, dal personaggio fluttuante o arrivando da "Creami un viaggio".
  useEffect(() => {
    const onAction = (event: Event) => {
      if ((event as CustomEvent).detail === "new-trip") setOpen(true);
    };
    window.addEventListener(ZEFIRO_ACTION_EVENT, onAction);
    const timer = new URLSearchParams(window.location.search).get("zefiro") ? window.setTimeout(() => setOpen(true), 0) : null;
    return () => {
      window.removeEventListener(ZEFIRO_ACTION_EVENT, onAction);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  function close() {
    if (planning || saving) return;
    setOpen(false);
  }

  function reset() {
    setPhase("brief");
    setError(null);
    setQuestions([]);
    setAnswers([]);
    setPlan(null);
    setProposals([]);
  }

  function runProposal(index: number, base: PlanOk, concept: { name: string; route: string; summary: string }) {
    setProposals((prev) => prev.map((p, i) => (i === index ? { ...p, status: "loading", error: undefined } : p)));
    generateProposal({ brief: base.brief, concept, durationDays: base.durationDays })
      .then((result) => {
        setProposals((prev) =>
          prev.map((p, i) =>
            i !== index
              ? p
              : "error" in result
                ? { ...p, status: "error", error: result.error }
                : { ...p, status: "ready", itinerary: result.itinerary },
          ),
        );
      })
      .catch(() => {
        setProposals((prev) => prev.map((p, i) => (i === index ? { ...p, status: "error", error: "Connessione interrotta. Riprova." } : p)));
      });
  }

  async function runPlan(formData: FormData) {
    setPlanning(true);
    setError(null);
    try {
      const result = await planTripWithZefiro(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("questions" in result) {
        setQuestions(result.questions);
        setAnswers(result.questions.map(() => ""));
        setPhase("questions");
        return;
      }
      if ("direct" in result) {
        setPlan(null);
        setTitle(result.direct.title);
        setDestination("");
        setProposals([{ name: "", route: "", summary: "", status: "ready", itinerary: result.direct.itinerary, keep: true }]);
        setPhase("review");
        return;
      }
      const p = result.plan;
      setPlan(p);
      setTitle(p.title);
      setDestination(p.destination ?? "");
      setProposals(p.concepts.map((c) => ({ ...c, status: "loading", keep: true })));
      setPhase("review");
      // Le proposte si scrivono insieme: il tempo totale è quello di una sola.
      p.concepts.forEach((c, i) => runProposal(i, p, c));
    } catch {
      setError("Qualcosa non ha funzionato. Controlla la connessione e riprova.");
    } finally {
      setPlanning(false);
    }
  }

  function onSubmitBrief(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (planning) return;
    const formData = new FormData(event.currentTarget);
    lastForm.current = formData;
    void runPlan(formData);
  }

  function onContinueWithAnswers() {
    if (!lastForm.current || planning) return;
    const formData = new FormData();
    lastForm.current.forEach((value, key) => formData.set(key, value));
    formData.set("clarifications", formatClarifications(questions, answers));
    void runPlan(formData);
  }

  const selected = proposals.filter((p) => p.keep);
  const waiting = selected.some((p) => p.status === "loading");
  const unusable = selected.some((p) => p.status === "error");
  const canSave = selected.length > 0 && !waiting && !unusable && title.trim().length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createTripFromProposals({
        title: title.trim(),
        destination: destination.trim() || null,
        clientId: clientId || null,
        startDate: startDate || null,
        proposals: selected.map((p) => ({ name: p.name || title, itinerary: p.itinerary as GeneratedItinerary })),
      });
      if (result?.error) setError(result.error);
    } catch (caught) {
      if (isRedirect(caught)) throw caught;
      setError("Non è stato possibile creare il viaggio. Controlla la connessione e riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-[#233c5e] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#17283f]"
      >
        <Sparkles size={14} /> Genera con {ASSISTANT_NAME}
      </button>

      {open && (
        <Modal
          title={`Genera con ${ASSISTANT_NAME}`}
          icon={<AssistantIcon size={26} />}
          wide={phase === "review"}
          onClose={close}
        >
          {phase === "brief" && (
            <form onSubmit={onSubmitBrief} className="flex flex-col gap-3">
              <p className="-mt-2 text-sm text-slate-500">
                Racconta a grandi linee il viaggio che vuoi. Se la richiesta è generica {ASSISTANT_NAME} propone{" "}
                <strong>3 itinerari diversi</strong>; se è già dettagliata (giorno per giorno) la ricostruisce com&apos;è.
              </p>
              <textarea
                ref={briefRef}
                name="brief"
                rows={7}
                autoFocus
                defaultValue=""
                placeholder="Es. Viaggio per 3 amici di vent'anni in Messico, cultura e vita notturna, 10 giorni, hotel, auto a noleggio (max 4 ore di guida)…"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  if (briefRef.current) briefRef.current.value = EXAMPLE;
                }}
                className="w-fit text-xs font-medium text-[#233c5e] underline decoration-dotted"
              >
                Inserisci un esempio
              </button>
              <DropzoneUpload
                name="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.xlsx,.csv,.txt,.md"
                label="Hai già una bozza? Carica un file (Excel/CSV, testo o foto)"
                autoSubmit={false}
              />
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              {planning && (
                <ZefiroThinking title={`${ASSISTANT_NAME} sta leggendo la richiesta…`} hint="Prepara il piano del viaggio: pochi secondi." />
              )}
              <div className="mt-1 flex items-center justify-end gap-2">
                <button type="button" onClick={close} disabled={planning} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60">
                  Annulla
                </button>
                <button type="submit" disabled={planning} className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60">
                  {planning ? "Un momento…" : `Genera con ${ASSISTANT_NAME}`}
                </button>
              </div>
            </form>
          )}

          {phase === "questions" && (
            <div className="flex flex-col gap-3">
              <AiQuestions
                questions={questions}
                answers={answers}
                onChange={(index, value) => setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)))}
              />
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              {planning && <ZefiroThinking title={`${ASSISTANT_NAME} sta preparando le proposte…`} hint="Pochi secondi." />}
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={reset} disabled={planning} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60">
                  Indietro
                </button>
                <button type="button" onClick={onContinueWithAnswers} disabled={planning} className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60">
                  Continua
                </button>
              </div>
            </div>
          )}

          {phase === "review" && (
            <div className="flex flex-col gap-4">
              <p className="-mt-2 text-sm text-slate-500">
                {proposals.length > 1
                  ? "Ecco le proposte. Tieni quelle che ti servono: se ne tieni più di una diventano le varianti dello stesso viaggio."
                  : "Ecco la proposta. Potrai modificarla a mano o con Zefiro."}
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="gen_title" className={labelClass}>
                    Titolo del viaggio *
                  </label>
                  <input id="gen_title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="gen_destination" className={labelClass}>
                    Destinazione
                  </label>
                  <input id="gen_destination" value={destination} onChange={(e) => setDestination(e.target.value)} className={inputClass} />
                </div>
                {clients.length > 0 && (
                  <div>
                    <label htmlFor="gen_client" className={labelClass}>
                      Cliente (opzionale)
                    </label>
                    <select id="gen_client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${inputClass} bg-white`}>
                      <option value="">Nessuno</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="gen_start" className={labelClass}>
                    Data di partenza (opzionale)
                  </label>
                  <DateField id="gen_start" name="gen_start" value={startDate} onChange={setStartDate} className={inputClass} />
                  <p className="mt-1 text-xs text-slate-500">Le date degli altri giorni si calcolano da sole. Puoi anche impostarla dopo.</p>
                </div>
              </div>

              <div className={`grid gap-3 ${proposals.length > 1 ? "lg:grid-cols-3" : ""}`}>
                {proposals.map((p, index) => (
                  <ProposalCard
                    key={index}
                    proposal={p}
                    single={proposals.length === 1}
                    onToggle={(keep) => setProposals((prev) => prev.map((x, i) => (i === index ? { ...x, keep } : x)))}
                    onRetry={plan ? () => runProposal(index, plan, p) : undefined}
                  />
                ))}
              </div>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={reset} disabled={saving} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60">
                  <RotateCcw size={14} /> Ricomincia
                </button>
                <div className="flex items-center gap-2">
                  {waiting && <span className="text-xs text-slate-500">Zefiro sta ancora scrivendo…</span>}
                  <button type="button" onClick={save} disabled={!canSave} className="rounded-md bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50">
                    {saving ? "Creo il viaggio…" : selected.length > 1 ? `Crea il viaggio con ${selected.length} varianti` : "Crea il viaggio"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function ProposalCard({
  proposal,
  single,
  onToggle,
  onRetry,
}: {
  proposal: Proposal;
  single: boolean;
  onToggle: (keep: boolean) => void;
  onRetry?: () => void;
}) {
  const days = proposal.itinerary ? [...proposal.itinerary.days].sort((a, b) => a.day_index - b.day_index) : [];
  return (
    <div className={`flex min-w-0 flex-col gap-2 rounded-xl border p-4 ${proposal.keep ? "border-[#cda876] bg-[#faf3e6]/50" : "border-slate-200 bg-white opacity-70"}`}>
      {!single && (
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={proposal.keep} onChange={(e) => onToggle(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
          <span className="min-w-0 text-base font-semibold text-[#233c5e]">{proposal.name}</span>
        </label>
      )}
      {proposal.route && <p className="text-xs font-medium text-slate-600">{proposal.route}</p>}
      {proposal.summary && <p className="text-sm text-slate-700">{proposal.summary}</p>}

      <div className="mt-1">
        {proposal.status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 size={15} className="animate-spin" /> Scrivo l&apos;itinerario…
          </p>
        )}
        {proposal.status === "error" && (
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle size={15} /> {proposal.error}
            </p>
            {onRetry && (
              <button type="button" onClick={onRetry} className="w-fit text-sm font-medium text-[#233c5e] underline">
                Riprova
              </button>
            )}
          </div>
        )}
        {proposal.status === "ready" && (
          <details>
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-green-700">
              <CheckCircle2 size={15} /> Pronta · {days.length} giorni <span className="text-xs font-normal text-slate-500">(vedi i giorni)</span>
            </summary>
            <ol className="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1 text-xs text-slate-700">
              {days.map((day, i) => (
                <li key={i}>
                  <span className="font-semibold">Giorno {i + 1}</span>
                  {day.title ? ` · ${day.title}` : ""}
                  <span className="block text-slate-500">{day.activities.map((a) => a.title).join(" · ")}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}
