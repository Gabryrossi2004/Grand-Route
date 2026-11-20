"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Loader2, Pencil, Printer, Sparkles, X } from "lucide-react";
import {
  generateCountrySheet,
  getCountrySheet,
  previewCustomCountrySheet,
  resetCountrySheet,
  saveCountrySheet,
  type CountrySheet,
} from "@/lib/actions/countrySheet";
import type { CountrySheetContent } from "@/lib/countrySheetAi";
import type { CustomizeOptions } from "@/lib/countrySheetShared";
import CountrySheetCustomize from "@/components/CountrySheetCustomize";
import CountrySheetEditor from "@/components/CountrySheetEditor";
import CountrySheetView from "@/components/CountrySheetView";
import CountrySuppliers from "@/components/CountrySuppliers";
import ShareSheetBar from "@/components/ShareSheetBar";
import { flagOf } from "@/lib/geo/countryCodes";


// Scheda paese per presentare una destinazione ai clienti: scheda tecnica + descrizione con 4 foto.
export default function CountrySheetPanel({
  code,
  name,
  onClose,
  initial,
}: {
  code: string;
  name: string;
  onClose: () => void;
  initial?: CountrySheet; // scheda già pronta (anteprima)
}) {
  const [sheet, setSheet] = useState<CountrySheet | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // personalizzazione: richieste a Zefiro, proposta da approvare, modifica a mano
  const [mode, setMode] = useState<"view" | "customize" | "proposal" | "edit">("view");
  const [proposal, setProposal] = useState<CountrySheetContent | null>(null);
  const [draft, setDraft] = useState<CountrySheetContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!initial)
      getCountrySheet(code).then((res) => {
        if (!alive) return;
        if (res.ok) setSheet(res.sheet);
        else setError(res.error);
        setLoading(false);
      });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [code, onClose, initial]);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await generateCountrySheet(code);
    setBusy(false);
    if (res.ok) {
      setSheet(res.sheet);
      setMode("view");
    } else setError(res.error);
  }

  async function runCustomize(opts: CustomizeOptions) {
    if (!sheet) return;
    setBusy(true);
    setError(null);
    const res = await previewCustomCountrySheet(code, sheet.content, opts);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setProposal(res.content);
    setMode("proposal");
    document.getElementById("country-sheet-body")?.scrollTo({ top: 0 });
  }

  async function saveContent(content: CountrySheetContent) {
    if (!sheet) return;
    setSaving(true);
    setError(null);
    const res = await saveCountrySheet(code, content, sheet.photos);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setSheet(res.sheet);
    setProposal(null);
    setDraft(null);
    setMode("view");
  }

  async function resetToLibrary() {
    if (!window.confirm("Vuoi tornare alla scheda della libreria Grand Route? Le tue modifiche a questa scheda verranno cancellate.")) return;
    setBusy(true);
    setError(null);
    const res = await resetCountrySheet(code);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setSheet(res.sheet);
    setMode("view");
  }

  const c = mode === "proposal" && proposal ? proposal : sheet?.content;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#0b1626]/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Scheda paese: ${name}`}
    >
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 cursor-default print:hidden"
      />
      <div className="country-sheet-print relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden bg-[#faf3e6] text-[#1d2b40] shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        {/* intestazione */}
        <div className="flex items-start gap-3 border-b border-[#e6d7bb] bg-[#233c5e] px-5 py-4 text-white">
          <span className="text-4xl leading-none">{flagOf(code)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#e3c27a]">
              Scheda paese
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight">
              {name}
            </h2>
            {c?.tagline && (
              <p className="mt-0.5 text-sm italic text-white/85">{c.tagline}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 print:hidden">
            {sheet && mode === "view" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("customize")}
                  className="flex items-center gap-1.5 rounded-full bg-[#e3c27a] px-3 py-1.5 text-xs font-semibold text-[#1d2b40] hover:bg-[#f0d596]"
                  title="Chiedi a Zefiro di adattare la scheda ai tuoi clienti"
                >
                  <Sparkles size={14} /> <span className="hidden sm:inline">Personalizza</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(structuredClone(sheet.content));
                    setMode("edit");
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
                  title="Modifica i testi a mano"
                >
                  <Pencil size={14} /> <span className="hidden sm:inline">Modifica</span>
                </button>
                {!initial && (
                  <button
                    type="button"
                    onClick={() => setShowShare((v) => !v)}
                    className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
                    title="Crea un link da mandare al cliente"
                  >
                    <Link2 size={14} /> <span className="hidden sm:inline">Condividi</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
                  title="Stampa o salva in PDF"
                >
                  <Printer size={14} />{" "}
                  <span className="hidden sm:inline">Stampa / PDF</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi la scheda"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div id="country-sheet-body" className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="flex items-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Apro la scheda…
            </p>
          ) : !sheet ? (
            <div className="flex flex-col items-start gap-3 p-6 sm:p-8">
              <p className="max-w-xl text-sm text-slate-700">
                La scheda di <strong>{name}</strong> non è ancora pronta. Zefiro
                prepara una scheda tecnica (capitale, moneta, fuso orario,
                documenti, clima, posti da visitare, come muoversi, cucina,
                consigli) e una descrizione con 4 foto. Resta salvata: la
                prepari una volta sola e puoi rigenerarla quando vuoi.
              </p>
              <button
                type="button"
                onClick={generate}
                disabled={busy || !!error?.includes("SQL")}
                className="flex items-center gap-2 rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3050] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {busy
                  ? "Zefiro sta preparando la scheda (circa 30 secondi)…"
                  : "Prepara la scheda con Zefiro"}
              </button>
              {error && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {error}
                </p>
              )}
            </div>
          ) : mode === "edit" && draft ? (
            <>
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#e6d7bb] bg-[#faf3e6]/95 px-5 py-3 backdrop-blur sm:px-6">
                <p className="text-sm font-medium text-[#233c5e]">Stai modificando i testi della scheda</p>
                <div className="flex items-center gap-2">
                  {error && <span className="text-sm text-red-700">{error}</span>}
                  <button type="button" onClick={() => setMode("view")} className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-white">
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveContent(draft)}
                    className="flex items-center gap-1.5 rounded-full bg-[#233c5e] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#1b3050] disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salva
                  </button>
                </div>
              </div>
              <CountrySheetEditor draft={draft} onChange={setDraft} />
            </>
          ) : (
            <>
            {showShare && mode === "view" && !initial && <ShareSheetBar code={code} onClose={() => setShowShare(false)} />}
            {mode === "customize" && (
              <CountrySheetCustomize
                busy={busy}
                error={error}
                canReset={!!sheet.libraryAvailable && !sheet.fromLibrary}
                onRun={runCustomize}
                onRegenerate={generate}
                onReset={resetToLibrary}
                onClose={() => {
                  setMode("view");
                  setError(null);
                }}
              />
            )}
            {mode === "proposal" && (
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#c58f2d] bg-[#fff6dd] px-5 py-3 sm:px-6 print:hidden">
                <p className="flex items-center gap-2 text-sm font-medium text-[#233c5e]">
                  <Sparkles size={16} className="text-[#c58f2d]" /> Proposta di Zefiro: controllala qui sotto
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {error && <span className="text-sm text-red-700">{error}</span>}
                  <button type="button" onClick={() => setMode("customize")} className="rounded-full px-3 py-1.5 text-sm text-[#233c5e] hover:bg-white">
                    Cambia le richieste
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(structuredClone(proposal!));
                      setMode("edit");
                    }}
                    className="rounded-full px-3 py-1.5 text-sm text-[#233c5e] hover:bg-white"
                  >
                    Ritocca a mano
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProposal(null);
                      setMode("view");
                    }}
                    className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
                  >
                    Scarta
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveContent(proposal!)}
                    className="flex items-center gap-1.5 rounded-full bg-[#233c5e] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#1b3050] disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salva questa versione
                  </button>
                </div>
              </div>
            )}
            <CountrySheetView
              content={c!}
              photos={sheet.photos}
              showAgentTips
              note={`${
                mode === "proposal"
                  ? "Proposta non ancora salvata"
                  : sheet.fromLibrary
                    ? "Scheda della libreria Grand Route"
                    : "Versione personalizzata dalla tua agenzia"
              } (aggiornata il ${new Date(sheet.updatedAt).toLocaleDateString("it-IT")}). Controlla sempre documenti e requisiti di ingresso prima della partenza.`}
              extra={
                <>
                  {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">{error}</p>}
                  {mode === "view" && <CountrySuppliers code={code} />}
                </>
              }
            />
            </>
          )}
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .country-sheet-print, .country-sheet-print * { visibility: visible !important; }
          .country-sheet-print { position: absolute !important; inset: 0 !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; }
          .country-sheet-print .overflow-y-auto { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
