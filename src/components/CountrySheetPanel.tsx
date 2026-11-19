"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer, RefreshCw, Sparkles, X } from "lucide-react";
import {
  generateCountrySheet,
  getCountrySheet,
  type CountrySheet,
} from "@/lib/actions/countrySheet";
import { flagOf } from "@/lib/geo/countryCodes";

const FACTS: { key: keyof CountrySheet["content"]["facts"]; label: string }[] =
  [
    { key: "capital", label: "Capitale" },
    { key: "languages", label: "Lingue" },
    { key: "currency", label: "Moneta" },
    { key: "timezone", label: "Fuso orario" },
    { key: "flight", label: "Volo dall'Italia" },
    { key: "bestPeriod", label: "Periodo migliore" },
    { key: "climate", label: "Clima" },
    { key: "plugs", label: "Prese elettriche" },
    { key: "driving", label: "Guida" },
    { key: "documents", label: "Documenti" },
  ];

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
    if (res.ok) setSheet(res.sheet);
    else setError(res.error);
  }

  const c = sheet?.content;

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
            {sheet && (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
                  title="Stampa o salva in PDF"
                >
                  <Printer size={14} />{" "}
                  <span className="hidden sm:inline">Stampa / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10 disabled:opacity-60"
                  title="Prepara di nuovo la scheda con Zefiro"
                >
                  <RefreshCw size={14} className={busy ? "animate-spin" : ""} />{" "}
                  <span className="hidden sm:inline">
                    {sheet.fromLibrary ? "Personalizza con Zefiro" : "Rigenera"}
                  </span>
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

        <div className="flex-1 overflow-y-auto">
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
          ) : (
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[340px_minmax(0,1fr)]">
              {/* scheda tecnica */}
              <section className="flex flex-col gap-5">
                <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
                  <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">
                    Scheda tecnica
                  </h3>
                  <dl className="flex flex-col gap-2 text-sm">
                    {FACTS.map((f) => (
                      <div key={f.key}>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">
                          {f.label}
                        </dt>
                        <dd className="text-slate-700">{c!.facts[f.key]}</dd>
                      </div>
                    ))}
                  </dl>
                  <a
                    href="https://www.viaggiaresicuri.it"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs font-semibold text-[#233c5e] underline print:hidden"
                  >
                    Verifica documenti e sicurezza su viaggiaresicuri.it
                  </a>
                </div>
                <List title="Come muoversi" items={c!.gettingAround} />
                <List title="Da assaggiare" items={c!.food} />
                <List title="Consigli pratici" items={c!.tips} />
              </section>

              {/* descrizione + foto */}
              <section className="flex flex-col gap-5">
                {sheet.photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {sheet.photos.slice(0, 4).map((p, i) => (
                      <figure
                        key={p.url}
                        className={`relative overflow-hidden rounded-2xl bg-[#efe3c8] ${i === 0 && sheet.photos.length !== 4 ? "col-span-2" : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt={p.title}
                          loading="lazy"
                          className="aspect-[4/3] h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-1.5 pt-6 text-white">
                          <span className="block text-sm font-semibold leading-tight">
                            {p.title}
                          </span>
                          <a
                            href={p.source}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-[10px] text-white/80 hover:underline"
                          >
                            Foto: {p.credit} · {p.license} · Wikimedia Commons
                          </a>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-slate-700">
                  {c!.description.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                <div>
                  <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">
                    Posti da visitare
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {c!.places.map((pl) => (
                      <li
                        key={pl.name}
                        className="rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-sm"
                      >
                        <span className="block font-semibold text-[#1d2b40]">
                          {pl.name}
                        </span>
                        <span className="text-slate-600">{pl.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {error && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
                    {error}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  {sheet.fromLibrary
                    ? "Scheda della libreria Grand Route"
                    : "Testi preparati da Zefiro"}{" "}
                  (aggiornata il{" "}
                  {new Date(sheet.updatedAt).toLocaleDateString("it-IT")}).
                  Controlla sempre documenti e requisiti di ingresso prima della
                  partenza.
                </p>
              </section>
            </div>
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

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">
        {title}
      </h3>
      <ul className="flex flex-col gap-1.5 text-sm text-slate-700">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c58f2d]" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
