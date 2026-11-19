"use client";

import { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { SHEET_SECTIONS, type CustomizeOptions, type SheetSectionId } from "@/lib/countrySheetShared";

const AUDIENCES = ["Coppie e viaggi di nozze", "Famiglie con bambini", "Gruppi", "Clientela di lusso", "Avventura e natura", "Giovani e budget", "Senior", "Cultura e arte"];
const TONES: { id: CustomizeOptions["tone"]; label: string }[] = [
  { id: "elegante", label: "Elegante" },
  { id: "emozionale", label: "Caldo ed emozionale" },
  { id: "pratico", label: "Pratico e sintetico" },
];
const LENGTHS: { id: CustomizeOptions["length"]; label: string }[] = [
  { id: "breve", label: "Più breve" },
  { id: "uguale", label: "Uguale" },
  { id: "dettagliata", label: "Più dettagliata" },
];

// Le richieste per Zefiro: cosa cambiare, per chi, con quale tono e lunghezza, quali parti della scheda
export default function CountrySheetCustomize({
  busy,
  error,
  canReset,
  onRun,
  onRegenerate,
  onReset,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  canReset: boolean;
  onRun: (opts: CustomizeOptions) => void;
  onRegenerate: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [instructions, setInstructions] = useState("");
  const [audience, setAudience] = useState<string[]>([]);
  const [tone, setTone] = useState<CustomizeOptions["tone"]>("elegante");
  const [length, setLength] = useState<CustomizeOptions["length"]>("uguale");
  const [sections, setSections] = useState<SheetSectionId[]>(["description"]);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${on ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e] hover:border-[#c58f2d]"}`;

  return (
    <section className="mx-5 mt-5 rounded-2xl border border-[#c58f2d] bg-white p-4 sm:mx-6 print:hidden">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">
          <Sparkles size={18} className="text-[#c58f2d]" /> Personalizza con Zefiro
        </h3>
        <button type="button" onClick={onClose} aria-label="Chiudi la personalizzazione" className="rounded-full p-1 text-slate-400 hover:text-slate-700">
          <X size={18} />
        </button>
      </div>
      <p className="mt-0.5 text-sm text-slate-500">Zefiro parte dalla scheda attuale e cambia solo ciò che chiedi. Vedrai la proposta prima di salvarla.</p>

      <label className="mt-3 block text-sm font-medium text-slate-700">
        Cosa vuoi cambiare?
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="Es. metti in evidenza il mare e le isole; cita il nostro partner locale «Sole Tours»; togli i consigli sulla guida in auto; aggiungi un paragrafo sul periodo dei ciliegi in fiore…"
          className="mt-1 w-full rounded-xl border border-[#e6d7bb] p-2.5 text-sm font-normal"
        />
      </label>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Per chi è pensata</p>
          <div className="flex flex-wrap gap-1.5">
            {AUDIENCES.map((a) => (
              <button key={a} type="button" onClick={() => setAudience((l) => toggle(l, a))} className={chip(audience.includes(a))}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Tono</p>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button key={t.id} type="button" onClick={() => setTone(t.id)} className={chip(tone === t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Lunghezza</p>
            <div className="flex flex-wrap gap-1.5">
              {LENGTHS.map((t) => (
                <button key={t.id} type="button" onClick={() => setLength(t.id)} className={chip(length === t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-sm font-medium text-slate-700">Parti da modificare</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {SHEET_SECTIONS.map((sct) => (
            <label key={sct.id} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" checked={sections.includes(sct.id)} onChange={() => setSections((l) => toggle(l, sct.id))} />
              {sct.label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || sections.length === 0}
          onClick={() => onRun({ instructions, audience, tone, length, sections })}
          className="flex items-center gap-2 rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3050] disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? "Zefiro sta preparando la proposta…" : "Prepara la proposta"}
        </button>
        <button type="button" onClick={onRegenerate} disabled={busy} className="text-sm text-slate-500 underline hover:text-[#233c5e] disabled:opacity-60">
          Rifai la scheda da zero
        </button>
        {canReset && (
          <button type="button" onClick={onReset} disabled={busy} className="text-sm text-slate-500 underline hover:text-[#233c5e] disabled:opacity-60">
            Torna alla scheda Grand Route
          </button>
        )}
      </div>
    </section>
  );
}
