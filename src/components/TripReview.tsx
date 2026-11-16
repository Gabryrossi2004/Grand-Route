"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import Modal from "@/components/Modal";
import { getReviewQuestions, getReviewSuggestions } from "@/app/dashboard/trips/[id]/review-actions";
import type { ReviewCategory, ReviewSuggestions } from "@/lib/tripReviewAi";
import { ASSISTANT_NAME } from "@/lib/assistant";
import AssistantIcon from "@/components/AssistantIcon";
import Zefiro, { ZefiroThinking } from "@/components/Zefiro";
import { ZEFIRO_ACTION_EVENT } from "@/components/ZefiroFloating";

type Stage = "intro" | "loading-questions" | "questions" | "loading-suggestions" | "results";
type Question = { question: string; why: string | null };

const categoryLabel: Record<ReviewCategory, string> = {
  errore: "Errore",
  logistica: "Logistica",
  orari: "Orari",
  ritmo: "Ritmo",
  completezza: "Completezza",
  esperienza: "Esperienza",
  stile: "Stile",
};

const priorityMeta = {
  alta: { label: "Da sistemare", border: "border-l-red-500", chip: "bg-red-50 text-red-700" },
  media: { label: "Consigliato", border: "border-l-amber-500", chip: "bg-amber-50 text-amber-700" },
  bassa: { label: "Facoltativo", border: "border-l-slate-300", chip: "bg-slate-100 text-slate-600" },
} as const;

// "Suggerimenti": l'AI rilegge il viaggio, chiede se serve un po' di contesto
// e propone correzioni e miglioramenti. Sono solo proposte da leggere.
export default function TripReview({ tripId, showButton = true }: { tripId: string; showButton?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<ReviewSuggestions | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setIsOpen(true);
    setStage("intro");
    setError(null);
  }

  useEffect(() => {
    const onAction = (event: Event) => {
      if ((event as CustomEvent).detail === "trip-assist") open();
    };
    window.addEventListener(ZEFIRO_ACTION_EVENT, onAction);
    return () => window.removeEventListener(ZEFIRO_ACTION_EVENT, onAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    if (stage === "loading-questions" || stage === "loading-suggestions") return;
    setIsOpen(false);
  }

  async function start() {
    setError(null);
    setStage("loading-questions");
    const response = await getReviewQuestions(tripId).catch(() => ({ error: "Connessione interrotta. Riprova." }));
    if ("error" in response) {
      setError(response.error);
      setStage("intro");
      return;
    }
    if (response.questions.length === 0) {
      await requestSuggestions([], []);
      return;
    }
    setQuestions(response.questions);
    setAnswers(response.questions.map(() => ""));
    setStage("questions");
  }

  async function requestSuggestions(asked: Question[], given: string[]) {
    setError(null);
    setStage("loading-suggestions");
    const payload = asked.map((item, index) => ({ question: item.question, answer: given[index] ?? "" }));
    const response = await getReviewSuggestions(tripId, payload).catch(() => ({
      error: "Connessione interrotta. Riprova.",
    }));
    if ("error" in response) {
      setError(response.error);
      setStage(asked.length > 0 ? "questions" : "intro");
      return;
    }
    setResult(response.result);
    setStage("results");
  }

  const grouped = (["alta", "media", "bassa"] as const).map((priority) => ({
    priority,
    items: (result?.suggestions ?? []).filter((item) => item.priority === priority),
  }));

  return (
    <>
      {showButton && (
        <button
          type="button"
          onClick={open}
          className="rounded-lg border border-[#cda876]/60 bg-[#faf3e6]/60 px-4 py-2 text-sm font-semibold text-[#233c5e] transition hover:bg-[#f2e2c4]"
        >
          {ASSISTANT_NAME}: suggerimenti
        </button>
      )}

      {isOpen && (
        <Modal
          title={`I suggerimenti di ${ASSISTANT_NAME}`}
          icon={<AssistantIcon size={26} />}
          onClose={close}
          wide={stage === "results"}
        >
          {stage === "intro" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-600">
                {ASSISTANT_NAME} rilegge l&apos;itinerario e propone correzioni e miglioramenti: orari che non tornano, tappe
                troppo ravvicinate, giorni troppo pieni o vuoti, descrizioni mancanti, idee per migliorare
                l&apos;esperienza.
              </p>
              <p className="text-sm text-slate-600">
                Prima potrebbe farti <strong>qualche domanda</strong> per capire meglio il contesto (chi viaggia, ritmo,
                budget). Puoi rispondere o saltarle. <strong>Non modifica nulla</strong>: sono proposte, decidi tu.
              </p>
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={start}
                  className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f]"
                >
                  Analizza il viaggio
                </button>
              </div>
            </div>
          )}

          {(stage === "loading-questions" || stage === "loading-suggestions") && (
            <ZefiroThinking
              title={
                stage === "loading-questions"
                  ? `${ASSISTANT_NAME} sta rileggendo il viaggio…`
                  : `${ASSISTANT_NAME} sta preparando i suggerimenti…`
              }
              hint="Può richiedere qualche decina di secondi."
            />
          )}

          {stage === "questions" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-600">
                Per consigliarti meglio, qualche domanda. Rispondi a quelle che vuoi, anche in poche parole.
              </p>
              {questions.map((item, index) => (
                <div key={index}>
                  <label htmlFor={`review_q_${index}`} className="mb-1 block text-sm font-medium text-slate-800">
                    {item.question}
                  </label>
                  {item.why && <p className="mb-1 text-xs text-slate-500">{item.why}</p>}
                  <textarea
                    id={`review_q_${index}`}
                    rows={2}
                    value={answers[index] ?? ""}
                    onChange={(e) => setAnswers((prev) => prev.map((value, i) => (i === index ? e.target.value : value)))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
                  />
                </div>
              ))}
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => requestSuggestions(questions, [])}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  Salta le domande
                </button>
                <button
                  type="button"
                  onClick={() => requestSuggestions(questions, answers)}
                  className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f]"
                >
                  Ottieni i suggerimenti
                </button>
              </div>
            </div>
          )}

          {stage === "results" && result && (
            <div className="flex flex-col gap-5">
              <p className="rounded-lg bg-[#faf3e6] px-4 py-3 text-sm leading-relaxed text-slate-700">{result.summary}</p>

              {result.suggestions.length === 0 && (
                <p className="text-sm text-slate-600">Nessun suggerimento: l&apos;itinerario mi sembra a posto così.</p>
              )}

              {grouped
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <section key={group.priority}>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {priorityMeta[group.priority].label} ({group.items.length})
                    </h4>
                    <ul className="flex flex-col gap-2">
                      {group.items.map((item, index) => (
                        <li
                          key={index}
                          className={`rounded-lg border border-[#e6d7bb] border-l-4 bg-white px-4 py-3 ${priorityMeta[group.priority].border}`}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityMeta[group.priority].chip}`}>
                              {categoryLabel[item.category]}
                            </span>
                            {item.day_number !== null && (
                              <span className="rounded-full bg-[#233c5e]/10 px-2 py-0.5 text-[11px] font-semibold text-[#233c5e]">
                                Giorno {item.day_number}
                              </span>
                            )}
                            {item.activity_title && (
                              <span className="truncate text-[11px] text-slate-500">{item.activity_title}</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                          <p className="mt-0.5 text-sm text-slate-600">{item.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}

              <p className="text-xs text-slate-500">
                Sono proposte di {ASSISTANT_NAME}, non verificate: controllale prima di applicarle. Dopo aver fatto modifiche
                puoi rianalizzare il viaggio.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setStage("intro");
                  }}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw size={14} /> Rianalizza
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f]"
                >
                  Chiudi
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
