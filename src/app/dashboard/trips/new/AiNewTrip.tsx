"use client";

import { useState } from "react";
import type { Client, PromptStyle } from "@/lib/types";
import DateField from "@/components/DateField";
import DropzoneUpload from "@/components/DropzoneUpload";
import Modal from "@/components/Modal";
import AiQuestions, { formatClarifications } from "@/components/AiQuestions";
import { createTripWithAi } from "./actions";
import { ASSISTANT_NAME } from "@/lib/assistant";
import AssistantIcon from "@/components/AssistantIcon";
import Zefiro, { ZefiroThinking } from "@/components/Zefiro";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

// "Genera con AI" dalla pagina Nuovo viaggio: prima si indicano le date (che
// servono per distribuire la bozza sui giorni), poi si dà la bozza, e il
// viaggio viene creato già con l'itinerario generato.
export default function AiNewTrip({ clients, promptStyles }: { clients: Client[]; promptStyles: PromptStyle[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
      // Se va a buon fine il server porta direttamente alla pagina del viaggio.
      const result = await createTripWithAi(undefined, formData);
      if (result?.questions && !questions) {
        setQuestions(result.questions);
        setAnswers(result.questions.map(() => ""));
      } else if (result?.error || result?.questions) {
        setError(result.error ?? `${ASSISTANT_NAME} ha ancora dubbi: aggiungi più dettagli alla bozza e riprova.`);
      }
    } catch (caught) {
      // Il reindirizzamento al nuovo viaggio non è un errore.
      if (caught && typeof caught === "object" && "digest" in caught && String((caught as { digest: string }).digest).startsWith("NEXT_REDIRECT")) {
        throw caught;
      }
      setError("Generazione non riuscita. Controlla la connessione e riprova.");
    } finally {
      setPending(false);
    }
  }

  const missingDates = !startDate || !endDate;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-[#cda876]/60 bg-[#faf3e6]/60 px-3 py-1.5 text-sm font-medium text-[#233c5e] hover:bg-[#f2e2c4]"
      >
        <AssistantIcon size={18} /> Chiedi a {ASSISTANT_NAME}
      </button>

      {isOpen && (
        <Modal
          title={`${ASSISTANT_NAME} crea il tuo viaggio`}
          icon={<AssistantIcon size={26} />}
          onClose={() => !pending && setIsOpen(false)}
        >
          <p className="mb-3 -mt-2 text-sm text-slate-500">
            Indica le date, incolla la bozza dell&apos;itinerario o carica un file: {ASSISTANT_NAME} crea il viaggio e lo
            distribuisce sui giorni, in attività da rivedere con calma. Non inventa orari o dati che non sono nella
            bozza.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label htmlFor="ai_title" className={labelClass}>
                Titolo del viaggio *
              </label>
              <input
                id="ai_title"
                name="title"
                type="text"
                required
                placeholder="Es. Luna di miele in Giappone"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="ai_destination" className={labelClass}>
                Destinazione
              </label>
              <input id="ai_destination" name="destination" type="text" placeholder="Es. Giappone" className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ai_start_date" className={labelClass}>
                  Data inizio *
                </label>
                <DateField
                  id="ai_start_date"
                  name="start_date"
                  value={startDate}
                  onChange={setStartDate}
                  highlightFrom={startDate}
                  highlightTo={endDate}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="ai_end_date" className={labelClass}>
                  Data fine *
                </label>
                <DateField
                  id="ai_end_date"
                  name="end_date"
                  value={endDate}
                  onChange={setEndDate}
                  openAt={startDate}
                  highlightFrom={startDate}
                  highlightTo={endDate}
                  className={inputClass}
                />
              </div>
            </div>

            {clients.length > 0 && (
              <div>
                <label htmlFor="ai_client_id" className={labelClass}>
                  Cliente collegato (opzionale)
                </label>
                <select id="ai_client_id" name="client_id" defaultValue="" className={`${inputClass} bg-white`}>
                  <option value="">Nessuno</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {promptStyles.length > 0 && (
              <div>
                <label htmlFor="ai_prompt_style" className={labelClass}>
                  Stile di scrittura (opzionale)
                </label>
                <select id="ai_prompt_style" name="prompt_style_id" defaultValue="" className={`${inputClass} bg-white`}>
                  <option value="">Nessuno in particolare</option>
                  {promptStyles.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <textarea
              name="draft_text"
              rows={7}
              placeholder={
                "Es.\nGiorno 1: arrivo a Roma, check-in Hotel Roma Centro. Cena libera.\nGiorno 2: ore 9:30 visita guidata al Colosseo. Pomeriggio al Foro Romano."
              }
              className={inputClass}
            />
            <DropzoneUpload
              name="draft_file"
              accept="image/jpeg,image/png,image/webp,image/gif,.xlsx,.csv,.txt,.md"
              label="Carica un file (Excel/CSV, testo, o una foto della bozza)"
              autoSubmit={false}
            />

            {missingDates && (
              <p className="text-xs text-amber-700">Scegli la data di inizio e di fine per poter generare.</p>
            )}
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
                title={`${ASSISTANT_NAME} sta preparando il viaggio…`}
                hint="Legge la bozza e la distribuisce sui giorni. Può richiedere fino a un minuto."
              />
            )}
            <div className="mt-1 flex items-center justify-end gap-2">
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
                disabled={pending || missingDates}
                className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
              >
                {pending ? "Creo il viaggio e genero…" : questions ? "Genera con le risposte" : "Crea e genera"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
