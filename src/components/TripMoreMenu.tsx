"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookmarkPlus, CalendarDays, Copy, FileCheck2, FileDown, Globe2, Languages, ListChecks, MoreHorizontal } from "lucide-react";
import SaveAsProposalDialog from "@/components/SaveAsProposalDialog";
import TripCountriesDialog from "@/components/TripCountriesDialog";
import SubmitButton from "@/components/SubmitButton";
import { TranslateTripDialog } from "@/components/TranslateTripButton";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { ZEFIRO_ACTION_EVENT } from "@/components/ZefiroFloating";

// Menu "Altro" della scheda viaggio: le azioni usate di rado, raccolte in un
// solo pulsante per tenere pulita la barra principale.
export default function TripMoreMenu({
  tripId,
  isFinal,
  stageAction,
  duplicateAction,
  modeAction,
  mode,
  hasContent,
  countries,
  autoCountries,
  tripTitle,
  destination,
}: {
  tripId: string;
  isFinal: boolean;
  stageAction: () => void | Promise<void>;
  duplicateAction: () => void | Promise<void>;
  modeAction: () => void | Promise<void>;
  mode: "activities" | "days";
  hasContent: boolean;
  countries?: string[] | null; // undefined = funzione non ancora attiva (manca SQL 0045)
  autoCountries?: string[] | null;
  tripTitle: string;
  destination: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [countriesOpen, setCountriesOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Zefiro (il personaggio) può aprire la traduzione
  useEffect(() => {
    const onAction = (event: Event) => {
      if ((event as CustomEvent).detail === "trip-translate") setTranslateOpen(true);
    };
    window.addEventListener(ZEFIRO_ACTION_EVENT, onAction);
    return () => window.removeEventListener(ZEFIRO_ACTION_EVENT, onAction);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-[#f1e6cf] disabled:opacity-60";
  const hint = "px-3 pb-1 text-xs text-slate-500";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <MoreHorizontal size={16} />
        Altro
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-[#e6d7bb] bg-[#faf3e6] p-1.5 shadow-lg"
        >
          <Link href={`/trips/${tripId}/preview?pdf=1`} target="_blank" role="menuitem" className={item}>
            <FileDown size={16} /> Salva in PDF
          </Link>

          <form action={stageAction}>
            <button type="submit" role="menuitem" className={item}>
              <FileCheck2 size={16} /> {isFinal ? "Segna come preliminare" : "Segna come finale"}
            </button>
          </form>
          <p className={hint}>Il cliente vede l&apos;etichetta «preliminare» o «finale» in cima all&apos;itinerario. Con l&apos;Operativo day by day attivo, quando diventa «finale» i servizi entrano da soli nella scheda operativa.</p>

          {!hasContent && (
            <>
              <form action={modeAction}>
                <button type="submit" role="menuitem" className={item}>
                  {mode === "days" ? <ListChecks size={16} /> : <CalendarDays size={16} />}
                  {mode === "days" ? "Organizza per attività" : "Organizza per giornata intera"}
                </button>
              </form>
              <p className={hint}>
                {mode === "days"
                  ? "Ora ogni giorno è un unico blocco di testo. Possibile solo finché l'itinerario è vuoto."
                  : "Ora ogni attività ha la sua scheda. Possibile solo finché l'itinerario è vuoto."}
              </p>
            </>
          )}

          <form action={duplicateAction}>
            <SubmitButton pendingLabel="Creazione variante…" className={item}>
              <Copy size={16} /> Crea variante
            </SubmitButton>
          </form>

          {hasContent && (
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                setProposalOpen(true);
              }}
            >
              <BookmarkPlus size={16} /> Salva come proposta in Libreria
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              setTranslateOpen(true);
            }}
          >
            <Languages size={16} /> Traduci con {ASSISTANT_NAME}
          </button>

          {countries !== undefined && (
            <>
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setOpen(false);
                  setCountriesOpen(true);
                }}
              >
                <Globe2 size={16} /> Paesi del viaggio
              </button>
              <p className={hint}>Per il mappamondo dell&apos;agenzia: si ricavano dall&apos;itinerario, qui puoi aggiungerne altri.</p>
            </>
          )}
        </div>
      )}

      {translateOpen && <TranslateTripDialog tripId={tripId} onClose={() => setTranslateOpen(false)} />}
      {proposalOpen && (
        <SaveAsProposalDialog
          tripId={tripId}
          tripTitle={tripTitle}
          destination={destination}
          countries={[...new Set([...(countries ?? []), ...(autoCountries ?? [])])]}
          onClose={() => setProposalOpen(false)}
        />
      )}
      {countriesOpen && <TripCountriesDialog tripId={tripId} manual={countries ?? []} auto={autoCountries ?? null} onClose={() => setCountriesOpen(false)} />}
    </div>
  );
}
