"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AutoImportResult } from "@/lib/actions/opsSheet";
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
  stageAction: () => Promise<{ stage: string; ops: AutoImportResult | null }>;
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
  const [stagePending, startStage] = useTransition();
  const [stageNote, setStageNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [opsHint, setOpsHint] = useState(false);

  // Segna come finale/preliminare e dice cosa è successo nell'Operativo
  const toggleStage = () =>
    startStage(async () => {
      const res = await stageAction();
      setOpen(false);
      const o = res.ops;
      if (!o) return setStageNote({ ok: true, text: "Itinerario segnato come preliminare." });
      // importazione spenta: la prima volta spieghiamo come attivarla, poi non lo diciamo più
      if (o.status === "import_off" || o.status === "off") {
        if (o.status === "import_off") {
          let seen = false;
          try {
            seen = window.localStorage.getItem("gr-ops-hint") === "1";
            window.localStorage.setItem("gr-ops-hint", "1");
          } catch {
            // senza memoria del browser lo mostriamo ogni volta: va bene lo stesso
          }
          if (!seen) setOpsHint(true);
        }
        return;
      }
      const msg: Record<AutoImportResult["status"], { ok: boolean; text: string }> = {
        added: { ok: true, text: `Itinerario finale: ${o.status === "added" ? o.count : 0} ${o.status === "added" && o.count === 1 ? "servizio aggiunto" : "servizi aggiunti"} all'Operativo, già «Confermato».` },
        none: { ok: true, text: "Itinerario finale. Nessun servizio nuovo per l'Operativo: sono già tutti presenti, oppure l'itinerario non ha attività da importare (le «Info» e il programma a giornata intera non diventano servizi)." },
        off: { ok: true, text: "" },
        import_off: { ok: true, text: "" },
        no_dates: { ok: false, text: "Itinerario finale, ma il viaggio non ha le date: aggiungile per far entrare i servizi nell'Operativo, poi segnalo di nuovo come finale." },
        error: { ok: false, text: "Itinerario finale, ma non sono riuscito ad aggiungere i servizi all'Operativo. Puoi usare «Importa dai viaggi» nell'Operativo." },
      };
      setStageNote(msg[o.status]);
    });

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
      {opsHint && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[#17283f]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Servizi nell'Operativo">
          <div className="modal-card w-full max-w-md rounded-2xl border border-[#e6d7bb] bg-[#fffaf0] p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#233c5e] text-[#cda876]">
              <FileCheck2 size={22} aria-hidden />
            </span>
            <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-semibold text-[#233c5e]">Itinerario finale</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Vuoi che i servizi dei viaggi finali entrino da soli nell&apos;<strong>Operativo</strong>, già confermati? Attiva
              <strong> «Importa i servizi dagli itinerari»</strong> in Impostazioni → Operativo day by day.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setOpsHint(false)} className="rounded-full border border-[#cbbfa6] px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white">
                Non ora
              </button>
              <Link href="/dashboard/settings#operativo" onClick={() => setOpsHint(false)} className="rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f]">
                Vai alle Impostazioni
              </Link>
            </div>
          </div>
        </div>
      )}
      {stageNote && (
        <div
          role="status"
          className={`absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border px-4 py-3 text-sm shadow-lg ${stageNote.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}
        >
          <p>{stageNote.text}</p>
          <div className="mt-2 flex items-center justify-end gap-3">
            <Link href="/dashboard/operativo" className="text-xs font-semibold underline">Apri l&apos;Operativo</Link>
            <button type="button" onClick={() => setStageNote(null)} className="text-xs font-semibold">OK</button>
          </div>
        </div>
      )}
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

          <button type="button" role="menuitem" className={item} onClick={toggleStage} disabled={stagePending}>
            <FileCheck2 size={16} /> {stagePending ? "Un attimo…" : isFinal ? "Segna come preliminare" : "Segna come finale"}
          </button>
          <p className={hint}>Il cliente vede l&apos;etichetta «preliminare» o «finale» in cima all&apos;itinerario. Con l&apos;importazione attiva nelle Impostazioni, quando diventa «finale» i servizi entrano da soli nell&apos;Operativo, già confermati.</p>

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
