"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, FileText, Plane, Plus, Search, Trash2, X } from "lucide-react";
import type { Activity, ActivityDetails, ActivityPhoto, ActivityTemplate, ActivityType, TripDocument } from "@/lib/types";
import { activityTypeOptions, detailFields, CHECK_OUT_DATE_KEY } from "@/lib/activityTypes";
import RichTextEditor from "@/components/RichTextEditor";
import DropzoneUpload from "@/components/DropzoneUpload";
import UploadForm from "@/components/UploadForm";
import { toSafeHtml } from "@/lib/richText";
import {
  deleteActivityPhoto,
  deleteDocument,
  uploadActivityPhoto,
  uploadDocument,
} from "@/app/dashboard/trips/[id]/actions";
import { searchFlight, type FlightLookupResult } from "@/app/dashboard/trips/[id]/flightActions";

// Quanto il titolo scritto dall'utente assomiglia al titolo di un template di
// libreria (parole in comune / parole totali): usato solo per ordinare i
// suggerimenti, mai per inventare testo nuovo.
function titleSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let common = 0;
  for (const word of wordsA) if (wordsB.has(word)) common++;
  return common / Math.max(wordsA.size, wordsB.size);
}

export default function ActivityForm({
  action,
  templates,
  initialActivity,
  onCancel,
  onSubmitted,
  tripId,
  photos,
  documents,
  dayDate,
}: {
  action: (formData: FormData) => void | Promise<void>;
  templates: ActivityTemplate[];
  initialActivity?: Activity;
  onCancel?: () => void;
  onSubmitted?: () => void;
  tripId?: string;
  photos?: ActivityPhoto[];
  documents?: (TripDocument & { signedUrl: string | null })[];
  dayDate?: string | null;
}) {
  const isEdit = Boolean(initialActivity);

  const [activityType, setActivityType] = useState<ActivityType>(initialActivity?.activity_type ?? "altro");
  const [title, setTitle] = useState(initialActivity?.title ?? "");
  const [location, setLocation] = useState(initialActivity?.location ?? "");
  const [description, setDescription] = useState(toSafeHtml(initialActivity?.description));
  const [startTime, setStartTime] = useState(initialActivity?.start_time?.slice(0, 5) ?? "");
  const [details, setDetails] = useState<ActivityDetails>(initialActivity?.details ?? {});
  const [templateId, setTemplateId] = useState("");
  const [flightNumberInput, setFlightNumberInput] = useState("");
  const [flightSearchState, setFlightSearchState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "results"; results: FlightLookupResult[] }
  >({ status: "idle" });

  const availableTemplates = templates.filter((t) => t.activity_type === activityType);
  const sortedTemplates = [...availableTemplates].sort(
    (a, b) => titleSimilarity(title, b.title) - titleSimilarity(title, a.title),
  );
  const bestMatchId =
    title.trim() && titleSimilarity(title, sortedTemplates[0]?.title ?? "") > 0 ? sortedTemplates[0].id : null;
  const fields = detailFields[activityType];

  function changeType(newType: ActivityType) {
    setActivityType(newType);
    setDetails({});
    setTemplateId("");
    setFlightSearchState({ status: "idle" });
  }

  function applyFlightResult(result: FlightLookupResult) {
    setDetails((prev) => ({
      ...prev,
      compagnia: result.airline || prev.compagnia,
      numero_volo: result.flightNumber,
      aeroporto_partenza: result.departureAirport || prev.aeroporto_partenza,
      aeroporto_arrivo: result.arrivalAirport || prev.aeroporto_arrivo,
      orario_arrivo: result.arrivalTime || prev.orario_arrivo,
      // Chiavi interne (non mostrate), usate dal server per creare in automatico
      // il blocco "Arrivo a ..." nel giorno giusto, anche se diverso da questo.
      _arrivo_citta: result.arrivalCity,
      _arrivo_iata: result.arrivalIata,
      _arrivo_data: result.arrivalDate,
    }));
    if (result.departureTime) setStartTime(result.departureTime);
    if (!title.trim() && result.departureAirport && result.arrivalAirport) {
      setTitle(`Volo ${result.departureAirport.split(" – ")[0]} → ${result.arrivalAirport.split(" – ")[0]}`);
    }
    setFlightSearchState({ status: "idle" });
  }

  async function runFlightSearch() {
    if (!dayDate) {
      setFlightSearchState({ status: "error", message: "Imposta prima la data di questo giorno del viaggio." });
      return;
    }
    if (!flightNumberInput.trim()) {
      setFlightSearchState({ status: "error", message: "Inserisci un numero di volo." });
      return;
    }
    setFlightSearchState({ status: "loading" });
    const result = await searchFlight(flightNumberInput, dayDate);
    if (result.error || !result.data) {
      setFlightSearchState({ status: "error", message: result.error ?? "Volo non trovato." });
      return;
    }
    if (result.data.length === 1) {
      applyFlightResult(result.data[0]);
    } else {
      setFlightSearchState({ status: "results", results: result.data });
    }
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setTitle(template.title);
    setLocation(template.location ?? "");
    setDescription(toSafeHtml(template.description));
    setDetails(template.details ?? {});
  }

  function resetAll(formEl: HTMLFormElement | null) {
    setActivityType("altro");
    setTitle("");
    setLocation("");
    setDescription("");
    setStartTime("");
    setDetails({});
    setTemplateId("");
    formEl?.reset();
  }

  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Si aspetta che il salvataggio sul server sia davvero concluso prima di
  // chiudere il modale o svuotare il form, invece di indovinare un tempo
  // d'attesa: così non si perde mai un'attività per una chiusura troppo rapida.
  // router.refresh() forza l'aggiornamento immediato dei dati della pagina:
  // avvolgendo l'azione in questa funzione client, Next.js non la riconosce
  // più come invio diretto di una Server Action e non la rinfresca da solo.
  const [, dispatch, pending] = useActionState(async (_prevState: null, formData: FormData) => {
    await action(formData);
    router.refresh();
    if (isEdit) {
      onCancel?.();
    } else {
      resetAll(formRef.current);
      onSubmitted?.();
    }
    return null;
  }, null);

  return (
    <>
    <form ref={formRef} action={dispatch} className="flex flex-col gap-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="details" value={JSON.stringify(details)} />

      <div className="grid gap-2 sm:grid-cols-[100px_140px_1fr]">
        <input
          name="start_time"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
        <select
          name="activity_type"
          value={activityType}
          onChange={(e) => changeType(e.target.value as ActivityType)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        >
          {activityTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {!isEdit &&
          (availableTemplates.length > 0 ? (
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
            >
              <option value="">Scrivi da zero…</option>
              {sortedTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.id === bestMatchId ? "⭐ Suggerito: " : "Dalla libreria: "}
                  {template.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="flex items-center text-xs text-slate-500">
              Nessuna attività di questo tipo in libreria
            </span>
          ))}
      </div>

      <input
        name="title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titolo attività (es. Check-in hotel)"
        required
        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
      />
      <input
        name="location"
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Luogo (opzionale)"
        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
      />
      <input type="hidden" name="description" value={description} />
      <RichTextEditor value={description} onChange={setDescription} placeholder="Descrizione (opzionale)" />

      {activityType === "volo" && (
        <div className="rounded-md border border-[#f2e2c4] bg-[#faf3e6]/60 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#11161b]">
            <Plane size={13} /> Compila automaticamente da numero di volo
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={flightNumberInput}
              onChange={(e) => setFlightNumberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runFlightSearch();
                }
              }}
              placeholder="Es. AZ610"
              className="w-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
            />
            <button
              type="button"
              onClick={runFlightSearch}
              disabled={flightSearchState.status === "loading"}
              className="flex items-center gap-1 rounded-md bg-[#233c5e] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
            >
              <Search size={13} />
              {flightSearchState.status === "loading" ? "Cerco…" : "Cerca"}
            </button>
          </div>
          {!dayDate && (
            <p className="mt-1.5 text-xs text-amber-600">
              Questo giorno non ha una data: imposta prima la data per poter cercare il volo.
            </p>
          )}
          {flightSearchState.status === "error" && (
            <p className="mt-1.5 text-xs text-red-600">{flightSearchState.message}</p>
          )}
          {flightSearchState.status === "results" && (
            <ul className="mt-2 flex flex-col gap-1">
              {flightSearchState.results.map((result, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => applyFlightResult(result)}
                    className="w-full rounded-md border border-[#e6d7bb] bg-white px-2 py-1.5 text-left text-xs text-slate-700 hover:border-[#ddc8a0] hover:bg-[#faf3e6]"
                  >
                    {result.airline} {result.flightNumber}: {result.departureAirport} ({result.departureTime}) →{" "}
                    {result.arrivalAirport} ({result.arrivalTime})
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {fields.length > 0 && (
        <div className="grid gap-2 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-medium text-slate-600">{field.label}</label>
              {field.type === "select" ? (
                <select
                  value={details[field.key] ?? ""}
                  onChange={(e) => setDetails({ ...details, [field.key]: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
                >
                  <option value="">—</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={details[field.key] ?? ""}
                  onChange={(e) => setDetails({ ...details, [field.key]: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
                />
              )}
              {field.key === CHECK_OUT_DATE_KEY && !isEdit && (
                <p className="mt-1 text-xs text-slate-500">
                  Crea automaticamente i giorni mancanti e aggiunge il check-out nel giorno giusto.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {isEdit && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex w-fit items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
          >
            <X size={15} /> Annulla
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex w-fit items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {!pending && (isEdit ? <Check size={15} /> : <Plus size={15} />)}
          {pending ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Aggiungi attività"}
        </button>
      </div>
    </form>

    {isEdit && initialActivity && tripId && (
      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Foto</p>
          {photos && photos.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative h-28 w-28">
                  <div className="relative h-full w-full overflow-hidden rounded-md">
                    <Image src={photo.url} alt="" fill sizes="7rem" className="object-cover" />
                  </div>
                  <form action={deleteActivityPhoto.bind(null, tripId, photo.id, photo.file_path)}>
                    <button
                      type="submit"
                      title="Elimina foto"
                      className="absolute -right-2 -top-2 hidden rounded-full bg-red-600 p-1.5 text-white group-hover:block"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <UploadForm action={uploadActivityPhoto.bind(null, tripId, initialActivity.id)}>
            <DropzoneUpload name="photo" accept="image/*" label="Carica foto" compressImages />
          </UploadForm>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Documenti</p>
          {documents && documents.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {documents.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm text-slate-700">
                    <FileText size={14} className="shrink-0 text-slate-500" />
                    {document.signedUrl ? (
                      <a
                        href={document.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-medium text-[#233c5e] hover:underline"
                      >
                        {document.file_name}
                      </a>
                    ) : (
                      <span className="truncate">{document.file_name}</span>
                    )}
                  </span>
                  <form action={deleteDocument.bind(null, tripId, document.id, document.file_path)}>
                    <button
                      type="submit"
                      title="Elimina documento"
                      className="shrink-0 rounded-md p-1.5 text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <UploadForm action={uploadDocument.bind(null, tripId, initialActivity.id)}>
            <DropzoneUpload name="file" label="Carica documento (voucher, biglietto…)" />
          </UploadForm>
        </div>
      </div>
    )}
    </>
  );
}
