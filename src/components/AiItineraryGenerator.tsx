"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PromptStyle } from "@/lib/types";
import DropzoneUpload from "@/components/DropzoneUpload";
import Modal from "@/components/Modal";
import AiQuestions, { formatClarifications } from "@/components/AiQuestions";
import { applyAiItineraryDraft } from "@/app/dashboard/trips/[id]/actions";
import { ASSISTANT_NAME } from "@/lib/assistant";
import AssistantIcon from "@/components/AssistantIcon";
import Zefiro, { ZefiroThinking } from "@/components/Zefiro";
import { ZEFIRO_ACTION_EVENT } from "@/components/ZefiroFloating";

export default function AiItineraryGenerator({
  tripId,
  promptStyles,
  showButton = true,
}: {
  tripId: string;
  promptStyles: PromptStyle[];
  showButton?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onAction = (event: Event) => {
      if ((event as CustomEvent).detail === "trip-assist") setIsOpen(true);
    };
    window.addEventListener(ZEFIRO_ACTION_EVENT, onAction);
    return () => window.removeEventListener(ZEFIRO_ACTION_EVENT, onAction);
  }, []);
  const router = useRouter();
  const action = applyAiItineraryDraft.bind(null, tripId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    if (questions) formData.set("clarifications", formatClarifications(questions, answers));

    setPending(true);
    setError(null);
    try {
      const result = await action(formData);
      if (result.questions && !questions) {
        setQuestions(result.questions);
        setAnswers(result.questions.map(() => ""));
      } else if (result.error || result.questions) {
        setError(result.error ?? `${ASSISTANT_NAME} ha ancora dubbi: aggiungi più dettagli alla bozza e riprova.`);
      } else {
        router.refresh();
        setIsOpen(false);
      }
    } catch {
      setError("Generazione non riuscita. Controlla la connessione e riprova.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {showButton && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-lg border border-[#cda876]/60 bg-[#faf3e6]/60 px-4 py-2 text-sm font-semibold text-[#233c5e] transition hover:bg-[#f2e2c4]"
        >
          {ASSISTANT_NAME}: crea l&apos;itinerario
        </button>
      )}

      {isOpen && (
        <Modal
          title={`${ASSISTANT_NAME} crea l'itinerario`}
          icon={<AssistantIcon size={26} />}
          onClose={() => setIsOpen(false)}
        >
          <p className="mb-3 -mt-2 text-sm text-slate-500">
            Incolla la bozza dell&apos;itinerario, carica un file (Excel/CSV o una foto), o entrambi: {ASSISTANT_NAME} la
            trasformerà in giorni e attività, da rivedere con calma prima di passare l&apos;itinerario a
            &quot;finale&quot;. Non inventa orari, numeri o altri dati che non sono già nella bozza.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {promptStyles.length > 0 && (
              <div>
                <label htmlFor="prompt_style_id" className="mb-1 block text-sm font-medium text-slate-700">
                  Stile di scrittura (opzionale)
                </label>
                <select
                  id="prompt_style_id"
                  name="prompt_style_id"
                  defaultValue=""
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
                >
                  <option value="">Nessuno in particolare</option>
                  {promptStyles.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.title}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Gestisci gli stili disponibili dalla{" "}
                  <a href="/dashboard/library" className="font-medium text-[#233c5e] hover:underline">
                    Libreria
                  </a>
                  .
                </p>
              </div>
            )}
            <textarea
              name="draft_text"
              rows={8}
              placeholder={
                "Es.\nGiorno 1: arrivo a Roma, check-in Hotel Roma Centro (via...). Cena libera.\nGiorno 2: ore 9:30 visita guidata al Colosseo, punto di incontro davanti all'ingresso. Pranzo libero. Pomeriggio al Foro Romano."
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
            />
            <DropzoneUpload
              name="draft_file"
              accept="image/jpeg,image/png,image/webp,image/gif,.xlsx,.csv,.txt,.md"
              label="Carica un file (Excel/CSV, testo, o una foto della bozza)"
              autoSubmit={false}
            />
            {questions && (
              <AiQuestions
                questions={questions}
                answers={answers}
                onChange={(index, value) => setAnswers((prev) => prev.map((item, i) => (i === index ? value : item)))}
              />
            )}
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            {pending && (
              <ZefiroThinking
                title={`${ASSISTANT_NAME} sta scrivendo l'itinerario…`}
                hint="Può richiedere fino a un minuto."
              />
            )}
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
              >
                {pending ? "Generazione in corso…" : questions ? "Genera con le risposte" : "Genera"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
