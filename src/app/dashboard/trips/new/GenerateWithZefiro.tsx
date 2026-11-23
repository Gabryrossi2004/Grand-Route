"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BookOpen, CheckCircle2, Loader2, RotateCcw, Search, Sparkles } from "lucide-react";
import type { Client, PromptStyle } from "@/lib/types";
import type { GeneratedItinerary } from "@/lib/itineraryAi";
import Modal from "@/components/Modal";
import DateField from "@/components/DateField";
import DropzoneUpload from "@/components/DropzoneUpload";
import GuidedBrief from "./GuidedBrief";
import AiQuestions, { formatClarifications } from "@/components/AiQuestions";
import AssistantIcon from "@/components/AssistantIcon";
import { ZefiroThinking } from "@/components/Zefiro";
import ItineraryModePicker from "@/components/ItineraryModePicker";
import type { ItineraryMode } from "@/lib/itineraryMode";
import { ZEFIRO_ACTION_EVENT } from "@/components/ZefiroFloating";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { applyProposalsToTrip, consultProposals, createTripFromProposals, generateProposal, planTripWithZefiro, type PlanOk } from "./zefiroActions";
import { destinationOptions, listAgencyItineraries, type DestinationOption } from "@/lib/actions/agencyItineraries";

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
  agency?: boolean;
};

function isRedirect(error: unknown) {
  return Boolean(error && typeof error === "object" && "digest" in error && String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT"));
}

// "Genera con Zefiro": si descrive il viaggio a grandi linee (o nel dettaglio) e Zefiro prepara
// una proposta, oppure tre se la richiesta è generica. Si scelgono quelle da tenere (le altre
// diventano varianti dello stesso viaggio) e si crea tutto in un colpo.
export default function GenerateWithZefiro({
  clients,
  promptStyles,
  trip,
  showButton = true,
  traveler = null,
}: {
  clients: Client[];
  promptStyles: PromptStyle[];
  // Dentro un viaggio già creato: le proposte vanno qui (se vuoto) o diventano varianti
  trip?: { id: string; hasContent: boolean; startDate: string | null; mode?: ItineraryMode };
  showButton?: boolean;
  // Viaggiatore privato: itinerari AI rimasti questo mese (solo testo, nessun file, nessuno stile)
  traveler?: { left: number; total: number } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // «choose» = le due strade: Genera itinerario (AI) o Consulta proposte (libreria, gratis)
  const [phase, setPhase] = useState<"choose" | "browse" | "brief" | "questions" | "review" | "done">("choose");
  // «Guidato» = domande una alla volta (senza AI); «Libero» = descrizione a parole
  const [briefMode, setBriefMode] = useState<"guided" | "free">("guided");
  const [briefText, setBriefText] = useState("");
  // Proposte pronte dalla libreria (gratis): si mostrano prima di chiedere a Zefiro
  const [libraryLabel, setLibraryLabel] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState("");
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanOk | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState(trip?.startDate ?? "");
  const [itineraryMode, setItineraryMode] = useState<ItineraryMode>(trip?.mode ?? "activities");
  const [saving, setSaving] = useState(false);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const lastForm = useRef<FormData | null>(null);

  // Si apre dal pulsante, dal personaggio fluttuante o arrivando da "Creami un viaggio".
  useEffect(() => {
    const wanted = trip ? "trip-generate" : "new-trip";
    const wantedProposals = trip ? "trip-proposals" : "new-trip-proposals";
    const onAction = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail === wanted || detail === wantedProposals) {
        resetAll(detail === wanted ? "brief" : "browse");
        setOpen(true);
      }
    };
    window.addEventListener(ZEFIRO_ACTION_EVENT, onAction);
    const param = !trip ? new URLSearchParams(window.location.search).get("zefiro") : null;
    const timer = param
      ? window.setTimeout(() => {
          resetAll(param === "proposte" ? "browse" : param === "genera" ? "brief" : "choose");
          setOpen(true);
        }, 0)
      : null;
    return () => {
      window.removeEventListener(ZEFIRO_ACTION_EVENT, onAction);
      if (timer) window.clearTimeout(timer);
    };
  }, [trip]);

  function close() {
    if (planning || saving) return;
    setOpen(false);
    if (phase === "done") router.refresh();
  }

  // Riparte da capo sulla schermata indicata (la scelta, la ricerca delle proposte o la richiesta a Zefiro)
  function resetAll(to: "choose" | "browse" | "brief") {
    setLibraryLabel(null);
    setPhase(to);
    setBriefMode("guided");
    setBriefText("");
    setError(null);
    setQuestions([]);
    setAnswers([]);
    setPlan(null);
    setProposals([]);
  }

  function openChooser() {
    resetAll("choose");
    setOpen(true);
  }

  function reset() {
    setLibraryLabel(null);
    setPhase("brief");
    setError(null);
    setQuestions([]);
    setAnswers([]);
    setPlan(null);
    setProposals([]);
  }

  function runProposal(index: number, base: PlanOk, concept: { name: string; route: string; summary: string }) {
    setProposals((prev) => prev.map((p, i) => (i === index ? { ...p, status: "loading", error: undefined } : p)));
    generateProposal({ brief: base.brief, concept, durationDays: base.durationDays, styleId: base.styleId, faithful: base.mode === "single" })
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
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (hasFile) {
      void runPlan(formData);
      return;
    }
    void runPlan(formData);
  }

  // «Consulta proposte»: itinerari pronti per la destinazione scelta (gratis, nessuna AI)
  async function showProposals(input: { kind: "country" | "italy"; key: string } | { text: string }) {
    setPlanning(true);
    setError(null);
    try {
      const lib = await consultProposals(input);
      if (!lib || lib.proposals.length === 0) {
        setError(
          lib
            ? `Per ${lib.label} non ci sono ancora proposte pronte. Puoi farne generare a ${ASSISTANT_NAME}.`
            : "Non ho trovato questa destinazione. Scegli un paese o una regione dall'elenco.",
        );
        return;
      }
      lastForm.current = null;
      setPlan(null);
      setLibraryLabel(lib.label);
      setTitle(`${lib.label} · ${lib.proposals[0].name}`);
      setDestination(lib.label);
      setProposals(lib.proposals.map((p, i) => ({ name: p.name, route: p.route, summary: p.summary, status: "ready", itinerary: p.itinerary, keep: i === 0, agency: p.agency })));
      setPhase("review");
    } catch {
      setError("Qualcosa non ha funzionato. Controlla la connessione e riprova.");
    } finally {
      setPlanning(false);
    }
  }

  // Dalle proposte della libreria a nuove proposte scritte da Zefiro (con AI)
  function generateWithAi() {
    if (planning) return;
    const label = libraryLabel;
    resetAll("brief");
    if (label) {
      setBriefText(`Viaggio in ${label}.`);
      setBriefMode("free");
    }
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
  const canSave = selected.length > 0 && !waiting && !unusable && (trip ? true : title.trim().length > 0) && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (trip) {
        const applied = await applyProposalsToTrip({
          tripId: trip.id,
          startDate: startDate || null,
          itineraryMode,
          proposals: selected.map((p) => ({ name: p.name || title, itinerary: p.itinerary as GeneratedItinerary })),
        });
        if ("error" in applied) {
          setError(applied.error);
          return;
        }
        setDoneMessage(
          applied.filled
            ? applied.variants > 0
              ? `Ho riempito questo viaggio con la prima proposta e creato ${applied.variants === 1 ? "1 variante" : `${applied.variants} varianti`} (le trovi in «Varianti di questo viaggio»).`
              : "Ho riempito questo viaggio con la proposta."
            : `Questo viaggio aveva già un itinerario, quindi non l'ho toccato: ho creato ${applied.variants === 1 ? "1 variante" : `${applied.variants} varianti`} (le trovi in «Varianti di questo viaggio»).`,
        );
        setPhase("done");
        router.refresh();
        return;
      }
      const result = await createTripFromProposals({
        title: title.trim(),
        destination: destination.trim() || null,
        clientId: clientId || null,
        startDate: startDate || null,
        itineraryMode,
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
      {showButton && (
        <button
          type="button"
          onClick={openChooser}
          className="flex items-center gap-1.5 rounded-md bg-[#233c5e] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#17283f]"
        >
          <Sparkles size={14} /> {ASSISTANT_NAME}: itinerari
        </button>
      )}

      {open && (
        <Modal
          title={
            phase === "choose"
              ? `${ASSISTANT_NAME}: crea l'itinerario`
              : phase === "browse" || (phase === "review" && libraryLabel)
                ? "Consulta proposte"
                : `Genera con ${ASSISTANT_NAME}`
          }
          icon={<AssistantIcon size={26} />}
          wide={phase === "review"}
          onClose={close}
        >
          {phase === "choose" && (
            <div className="flex flex-col gap-3">
              <p className="-mt-2 text-sm text-slate-500">Come vuoi partire?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => resetAll("brief")}
                  className="flex flex-col gap-2 rounded-2xl border-2 border-[#233c5e] bg-white p-4 text-left transition hover:bg-[#eef2f8]"
                >
                  <span className="flex items-center gap-2 text-base font-semibold text-[#233c5e]">
                    <Sparkles size={18} /> Genera itinerario
                  </span>
                  <span className="text-sm text-slate-600">
                    {traveler
                      ? `${ASSISTANT_NAME} scrive un itinerario su misura per te, da quello che gli racconti.`
                      : `${ASSISTANT_NAME} scrive su misura per il tuo cliente, da una descrizione o da una bozza.`}
                  </span>
                  <span className="mt-auto w-fit rounded-full bg-[#233c5e] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {traveler ? `Creato con AI · ${traveler.left} su ${traveler.total} questo mese` : "Creato con AI"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => resetAll("browse")}
                  className="flex flex-col gap-2 rounded-2xl border-2 border-emerald-600 bg-white p-4 text-left transition hover:bg-emerald-50"
                >
                  <span className="flex items-center gap-2 text-base font-semibold text-emerald-800">
                    <BookOpen size={18} /> Consulta proposte
                  </span>
                  <span className="text-sm text-slate-600">
                    {traveler
                      ? "Itinerari già pronti giorno per giorno, per ogni paese e regione italiana: scegli e poi modifichi come vuoi."
                      : "Itinerari già pronti giorno per giorno: i vostri e quelli di Grand Route per ogni paese e regione italiana."}
                  </span>
                  <span className="mt-auto w-fit rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">Gratis, senza AI</span>
                </button>
              </div>
            </div>
          )}

          {phase === "browse" && (
            <BrowseProposals
              busy={planning}
              error={error}
              onPick={(input) => void showProposals(input)}
              onBack={() => resetAll("choose")}
              onAi={() => resetAll("brief")}
            />
          )}

          {phase === "brief" && briefMode === "guided" && (
            <GuidedBrief
              onDone={(text) => {
                setBriefText(text);
                setBriefMode("free");
              }}
              onSkip={() => setBriefMode("free")}
            />
          )}

          {phase === "brief" && briefMode === "free" && (
            <form onSubmit={onSubmitBrief} className="flex flex-col gap-3">
              <p className="-mt-2 text-sm text-slate-500">
                {traveler ? (
                  <>
                    Racconta a grandi linee il viaggio che vuoi: {ASSISTANT_NAME} propone fino a <strong>{Math.min(3, traveler.left)} itinerari diversi</strong>, e ognuno conta come uno dei tuoi{" "}
                    {traveler.total} itinerari del mese (te ne restano <strong>{traveler.left}</strong>). Le proposte pronte sono sempre gratis.
                  </>
                ) : (
                  <>
                    Racconta a grandi linee il viaggio che vuoi. Se la richiesta è generica {ASSISTANT_NAME} propone <strong>3 itinerari diversi</strong>; se è già dettagliata (giorno per giorno) la ricostruisce com&apos;è.
                  </>
                )}
              </p>
              <textarea
                ref={briefRef}
                name="brief"
                rows={7}
                autoFocus
                key={briefText}
                defaultValue={briefText}
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
              <button type="button" onClick={() => setBriefMode("guided")} className="w-fit text-xs font-medium text-[#233c5e] underline decoration-dotted">
                Torna alle domande guidate
              </button>
              {!traveler && !(trip && trip.hasContent) && <ItineraryModePicker value={itineraryMode} onChange={setItineraryMode} />}
              {!traveler && promptStyles.length > 0 && (
                <div>
                  <label htmlFor="gen_style" className={labelClass}>
                    Stile di scrittura (opzionale)
                  </label>
                  <select id="gen_style" name="prompt_style_id" defaultValue="" className={`${inputClass} bg-white`}>
                    <option value="">Nessuno in particolare</option>
                    {promptStyles.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!traveler && (
                <DropzoneUpload
                  name="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,.xlsx,.csv,.txt,.md"
                  label="Hai già una bozza? Carica un file (Excel/CSV, testo o foto)"
                  autoSubmit={false}
                />
              )}
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

          {phase === "done" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-700">{doneMessage}</p>
              <div className="flex justify-end">
                <button type="button" onClick={close} className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f]">
                  Chiudi
                </button>
              </div>
            </div>
          )}

          {phase === "review" && (
            <div className="flex flex-col gap-4">
              {libraryLabel && (
                <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900">
                  <span>
                    <strong>Proposte pronte per {libraryLabel}</strong>, con il programma giorno per giorno: gratis, senza usare l&apos;AI.
                    Scegli quella che preferisci (più di una diventano varianti).
                  </span>
                  <button
                    type="button"
                    onClick={generateWithAi}
                    disabled={planning || saving}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    <Sparkles size={13} /> Genera nuove proposte con {ASSISTANT_NAME}
                  </button>
                </div>
              )}
              {planning && <ZefiroThinking title={`${ASSISTANT_NAME} sta leggendo la richiesta…`} hint="Prepara nuove proposte su misura." />}
              <p className="-mt-2 text-sm text-slate-500">
                {trip
                  ? trip.hasContent
                    ? "Questo viaggio ha già un itinerario: non lo tocco. Le proposte che tieni diventano varianti di questo viaggio."
                    : "Questo viaggio è vuoto: la prima proposta che tieni lo riempie, le altre diventano varianti."
                  : proposals.length > 1
                    ? "Ecco le proposte. Tieni quelle che ti servono: se ne tieni più di una diventano le varianti dello stesso viaggio."
                    : "Ecco la proposta. Potrai modificarla a mano o con Zefiro."}
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                {!trip && (
                  <div>
                    <label htmlFor="gen_title" className={labelClass}>
                      Titolo del viaggio *
                    </label>
                    <input id="gen_title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                  </div>
                )}
                {!trip && (
                  <div>
                    <label htmlFor="gen_destination" className={labelClass}>
                      Destinazione
                    </label>
                    <input id="gen_destination" value={destination} onChange={(e) => setDestination(e.target.value)} className={inputClass} />
                  </div>
                )}
                {!trip && clients.length > 0 && (
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
                <button type="button" onClick={() => resetAll(libraryLabel ? "browse" : "choose")} disabled={saving} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60">
                  <RotateCcw size={14} /> {libraryLabel ? "Altra destinazione" : "Ricomincia"}
                </button>
                <div className="flex items-center gap-2">
                  {waiting && <span className="text-xs text-slate-500">Zefiro sta ancora scrivendo…</span>}
                  <button type="button" onClick={save} disabled={!canSave} className="rounded-md bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50">
                    {saving
                      ? "Salvo…"
                      : trip
                        ? selected.length > 1
                          ? `Usa ${selected.length} proposte`
                          : "Usa questa proposta"
                        : selected.length > 1
                          ? `Crea il viaggio con ${selected.length} varianti`
                          : "Crea il viaggio"}
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
      {proposal.agency && (
        <span className="w-fit rounded-full bg-[#233c5e] px-2 py-0.5 text-[11px] font-semibold text-white">Vostro itinerario</span>
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

// Ricerca della destinazione per «Consulta proposte»: elenco di paesi e regioni italiane, oppure un
// luogo scritto a mano (es. «Petra», «Machu Picchu»). In cima le destinazioni con itinerari dell'agenzia.
function BrowseProposals({
  busy,
  error,
  onPick,
  onBack,
  onAi,
}: {
  busy: boolean;
  error: string | null;
  onPick: (input: { kind: "country" | "italy"; key: string } | { text: string }) => void;
  onBack: () => void;
  onAi: () => void;
}) {
  const [options, setOptions] = useState<DestinationOption[]>([]);
  const [mine, setMine] = useState<{ kind: "country" | "italy"; key: string; label: string; count: number }[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    destinationOptions().then((o) => alive && setOptions(o)).catch(() => {});
    listAgencyItineraries()
      .then((res) => {
        if (!alive || !res.ok) return;
        const byPlace = new Map<string, { kind: "country" | "italy"; key: string; label: string; count: number }>();
        for (const it of res.items) {
          const id = `${it.kind}:${it.place_key}`;
          const cur = byPlace.get(id) ?? { kind: it.kind, key: it.place_key, label: it.place_label, count: 0 };
          cur.count += 1;
          byPlace.set(id, cur);
        }
        setMine([...byPlace.values()].sort((a, b) => b.count - a.count).slice(0, 12));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const n = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const q = n(query);
  const suggestions = q.length >= 2 ? options.filter((o) => n(o.label).includes(q)).slice(0, 8) : [];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || q.length < 2) return;
    const exact = options.find((o) => n(o.label) === q) ?? (suggestions.length === 1 ? suggestions[0] : null);
    onPick(exact ? { kind: exact.kind, key: exact.key } : { text: query });
  }

  const chip = "rounded-full border border-[#e6d7bb] bg-white px-3 py-1 text-sm text-[#233c5e] hover:border-[#cda876] hover:bg-[#faf3e6] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3">
      <p className="-mt-2 text-sm text-slate-500">
        Scegli il paese o la regione italiana: vedrai gli itinerari pronti, con il programma giorno per giorno. Gratis, senza AI.
      </p>
      <form onSubmit={submit} className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Es. Giordania, Toscana, Petra, Bora Bora…"
          className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-24 text-sm outline-none focus:border-[#cda876]"
        />
        <button
          type="submit"
          disabled={busy || q.length < 2}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Cerco…" : "Cerca"}
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((o) => (
            <button key={`${o.kind}:${o.key}`} type="button" disabled={busy} onClick={() => onPick({ kind: o.kind, key: o.key })} className={chip}>
              {o.label}
              {o.kind === "italy" && <span className="ml-1 text-xs text-slate-500">(Italia)</span>}
            </button>
          ))}
        </div>
      )}
      {mine.length > 0 && q.length < 2 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Dove avete già vostri itinerari</p>
          <div className="flex flex-wrap gap-1.5">
            {mine.map((m) => (
              <button key={`${m.kind}:${m.key}`} type="button" disabled={busy} onClick={() => onPick({ kind: m.kind, key: m.key })} className={chip}>
                {m.label} <span className="text-xs text-slate-500">· {m.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {busy && (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={15} className="animate-spin" /> Cerco le proposte…
        </p>
      )}
      {error && (
        <div className="flex flex-col gap-1.5 text-sm text-red-600" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onAi} className="w-fit font-medium text-[#233c5e] underline">
            Genera con {ASSISTANT_NAME} (AI)
          </button>
        </div>
      )}
      <div className="flex justify-start">
        <button type="button" onClick={onBack} disabled={busy} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60">
          Indietro
        </button>
      </div>
    </div>
  );
}
