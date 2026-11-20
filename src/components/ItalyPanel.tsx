"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Folder, FolderOpen, Loader2, MapPin, Printer, X } from "lucide-react";
import { getItalyPhotos } from "@/lib/actions/italy";
import type { SheetPhoto } from "@/lib/countryPhotos";
import CountrySuppliers from "@/components/CountrySuppliers";
import { ITALY_FACT_LABELS, ITALY_ORDER, ITALY_REGIONS, type ItalyPlace } from "@/lib/italyLibrary";

export type ItalyView = { region: string | null; zone: string | null };

// Italia per i tour operator di incoming: regione per regione, e dentro ogni regione le zone
// (es. Toscana → Chianti, Val d'Orcia…), con scheda tecnica, descrizione e 4 foto.
export default function ItalyPanel({
  start,
  onClose,
  onNavigate,
  onOpenCountrySheet,
}: {
  start: ItalyView;
  onClose: () => void;
  onNavigate?: (view: ItalyView) => void; // per evidenziare regione e zone sul mappamondo
  onOpenCountrySheet?: () => void;
}) {
  const [view, setView] = useState<ItalyView>(start);
  const [photos, setPhotos] = useState<Record<string, SheetPhoto[]>>({});
  const requested = useRef(new Set<string>());
  const region = view.region ? ITALY_REGIONS[view.region] : null;
  const zone = region && view.zone ? region.zones.find((z) => z.id === view.zone) ?? null : null;
  const photoKey = view.region ? `${view.region}/${view.zone ?? ""}` : "";

  const go = (next: ItalyView) => {
    setView(next);
    onNavigate?.(next);
    document.getElementById("italy-panel-body")?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!view.region || requested.current.has(photoKey)) return;
    requested.current.add(photoKey);
    getItalyPhotos(view.region, view.zone ?? undefined).then((list) => setPhotos((p) => ({ ...p, [photoKey]: list })));
  }, [view.region, view.zone, photoKey]);

  const pics: SheetPhoto[] | "loading" | undefined = view.region ? ((photos[photoKey] as SheetPhoto[] | undefined) ?? "loading") : undefined;
  const title = zone ? zone.name : region ? region.name : "Italia";
  const tagline = zone ? zone.tagline : region ? region.tagline : "Le 20 regioni, zona per zona: scegli una cartella.";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#0b1626]/70 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Italia: ${title}`}>
      <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0 cursor-default print:hidden" />
      <div className="italy-sheet-print relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden bg-[#faf3e6] text-[#1d2b40] shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        {/* intestazione con il percorso Italia › Regione › Zona */}
        <div className="flex items-start gap-3 border-b border-[#e6d7bb] bg-[#233c5e] px-5 py-4 text-white">
          <span className="text-4xl leading-none">🇮🇹</span>
          <div className="min-w-0 flex-1">
            <nav className="flex flex-wrap items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[#e3c27a]" aria-label="Percorso">
              <button type="button" onClick={() => go({ region: null, zone: null })} className="hover:underline">
                Italia
              </button>
              {region && (
                <>
                  <ChevronRight size={12} />
                  <button type="button" onClick={() => go({ region: view.region, zone: null })} className="hover:underline">
                    {region.name}
                  </button>
                </>
              )}
              {zone && (
                <>
                  <ChevronRight size={12} />
                  <span>{zone.name}</span>
                </>
              )}
            </nav>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight">{title}</h2>
            <p className="mt-0.5 text-sm italic text-white/85">{tagline}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 print:hidden">
            {region && (
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
                title="Stampa o salva in PDF"
              >
                <Printer size={14} /> <span className="hidden sm:inline">Stampa / PDF</span>
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Chiudi la scheda" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
        </div>

        <div id="italy-panel-body" className="flex-1 overflow-y-auto">
          {!region ? (
            /* ── tutte le regioni (cartelle) ── */
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <p className="max-w-3xl text-sm text-slate-600">
                Ogni regione ha una scheda tecnica (aeroporti, come arrivare, periodo, UNESCO, prodotti tipici), una descrizione con 4 foto e le sue zone da
                visitare, ciascuna con luoghi, esperienze, per chi è adatta e quando andarci. Puoi anche toccare una regione sul mappamondo.
              </p>
              {onOpenCountrySheet && (
                <button type="button" onClick={onOpenCountrySheet} className="w-fit text-sm font-semibold text-[#233c5e] underline print:hidden">
                  Apri la scheda paese dell&apos;Italia (documenti, fuso, prese…)
                </button>
              )}
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ITALY_ORDER.map((code) => {
                  const r = ITALY_REGIONS[code];
                  return (
                    <li key={code}>
                      <button
                        type="button"
                        onClick={() => go({ region: code, zone: null })}
                        className="group flex h-full w-full items-start gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-3 text-left transition hover:border-[#c58f2d] hover:shadow-sm"
                      >
                        <Folder className="mt-0.5 h-5 w-5 shrink-0 text-[#c58f2d] group-hover:hidden" />
                        <FolderOpen className="mt-0.5 hidden h-5 w-5 shrink-0 text-[#c58f2d] group-hover:block" />
                        <span className="min-w-0">
                          <span className="block font-semibold text-[#1d2b40]">{r.name}</span>
                          <span className="block text-xs text-slate-500">
                            {r.zones.length} zone · {r.zones.map((z) => z.name).slice(0, 3).join(", ")}
                            {r.zones.length > 3 ? "…" : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[340px_minmax(0,1fr)]">
              {/* colonna sinistra: scheda tecnica (regione) o "in breve" (zona) */}
              <section className="flex flex-col gap-5">
                {zone ? (
                  <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
                    <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">In breve</h3>
                    <dl className="flex flex-col gap-2 text-sm">
                      <Fact label="Regione" value={region.name} />
                      <Fact label="Ideale per" value={zone.idealFor} />
                      <Fact label="Periodo migliore" value={zone.bestPeriod} />
                      <Fact label="Aeroporti della regione" value={region.facts.aeroporti} />
                    </dl>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
                    <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">Scheda tecnica</h3>
                    <dl className="flex flex-col gap-2 text-sm">
                      {ITALY_FACT_LABELS.map((f) => (
                        <Fact key={f.key} label={f.label} value={region.facts[f.key]} />
                      ))}
                    </dl>
                  </div>
                )}
                <List title={zone ? "Esperienze" : "Attività ed esperienze"} items={zone ? zone.experiences : region.experiences} />
                {!zone && <List title="Da assaggiare" items={region.food} />}
                {!zone && <List title="Come muoversi" items={region.gettingAround} />}
                {!zone && <List title="Consigli pratici" items={region.tips} />}
              </section>

              {/* colonna destra: foto, descrizione, zone (sottocartelle) e luoghi */}
              <section className="flex flex-col gap-5">
                {pics === "loading" ? (
                  <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 size={14} className="animate-spin" /> Cerco le foto…
                  </p>
                ) : pics && pics.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {pics.slice(0, 4).map((p, i) => (
                      <figure key={p.url} className={`relative overflow-hidden rounded-2xl bg-[#efe3c8] ${i === 0 && pics.length !== 4 ? "col-span-2" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.title} loading="lazy" className="aspect-[4/3] h-full w-full object-cover" referrerPolicy="no-referrer" />
                        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-1.5 pt-6 text-white">
                          <span className="block text-sm font-semibold leading-tight">{p.title}</span>
                          <a href={p.source} target="_blank" rel="noreferrer" className="block truncate text-[10px] text-white/80 hover:underline">
                            Foto: {p.credit} · {p.license} · Wikimedia Commons
                          </a>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-slate-700">
                  {(zone ? zone.description : region.description).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>

                {!zone && (
                  <div>
                    <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">Zone da visitare</h3>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {region.zones.map((z) => (
                        <li key={z.id}>
                          <button
                            type="button"
                            onClick={() => go({ region: view.region, zone: z.id })}
                            className="group flex h-full w-full items-start gap-2.5 rounded-xl border border-[#e6d7bb] bg-white px-3 py-2.5 text-left text-sm transition hover:border-[#c58f2d] hover:shadow-sm"
                          >
                            <Folder className="mt-0.5 h-4 w-4 shrink-0 text-[#c58f2d]" />
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-[#1d2b40]">{z.name}</span>
                              <span className="text-slate-600">{z.tagline}</span>
                            </span>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#233c5e] print:hidden" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Places title={zone ? "Da non perdere" : "Luoghi simbolo"} items={zone ? zone.highlights : region.places} />

                {view.region && <CountrySuppliers code="IT" region={view.region} />}

                {zone && (
                  <div className="print:hidden">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#a87a1e]">Altre zone di {region.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      {region.zones
                        .filter((z) => z.id !== zone.id)
                        .map((z) => (
                          <button
                            key={z.id}
                            type="button"
                            onClick={() => go({ region: view.region, zone: z.id })}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#e6d7bb] bg-white px-3 py-1 text-sm text-[#233c5e] hover:border-[#c58f2d]"
                          >
                            <MapPin size={13} className="text-[#c58f2d]" /> {z.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  Scheda della libreria Grand Route. Orari, aperture e regole di accesso (parchi, spiagge a numero chiuso, ZTL) cambiano: verificali prima di
                  confermare i servizi.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .italy-sheet-print, .italy-sheet-print * { visibility: visible !important; }
          .italy-sheet-print { position: absolute !important; inset: 0 !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; }
          .italy-sheet-print .overflow-y-auto { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">{title}</h3>
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

function Places({ title, items }: { title: string; items: ItalyPlace[] }) {
  return (
    <div>
      <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">{title}</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((pl) => (
          <li key={pl.name} className="rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-sm">
            <span className="block font-semibold text-[#1d2b40]">{pl.name}</span>
            <span className="text-slate-600">{pl.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
