import type { ReactNode } from "react";
import type { CountrySheetContent } from "@/lib/countrySheetAi";
import type { SheetPhoto } from "@/lib/countryPhotos";
import { photoSrc } from "@/lib/photoSrc";
import CountryGuideSections from "@/components/CountryGuideSections";

const FACTS: { key: keyof CountrySheetContent["facts"]; label: string }[] =
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

// Come si vede una scheda paese: la usano il pannello dell'agenzia e la pagina pubblica per il cliente.
// «extra» è per contenuti solo dell'agenzia (es. i suoi fornitori); i consigli per l'agente si nascondono ai clienti.
export default function CountrySheetView({
  content,
  photos,
  note,
  extra,
  showAgentTips = true,
}: {
  content: CountrySheetContent;
  photos: SheetPhoto[];
  note?: string;
  extra?: ReactNode;
  showAgentTips?: boolean;
}) {
  return (
    <>
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
                <dd className="text-slate-700">{content.facts[f.key]}</dd>
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
        <List title="Come muoversi" items={content.gettingAround} />
        <List title="Da assaggiare" items={content.food} />
        <List title="Consigli pratici" items={content.tips} />
      </section>

      {/* descrizione + foto */}
      <section className="flex flex-col gap-5">
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {photos.slice(0, 4).map((p, i) => (
              <figure
                key={p.url}
                className={`relative overflow-hidden rounded-2xl bg-[#efe3c8] ${i === 0 && photos.length !== 4 ? "col-span-2" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoSrc(p.url)}
                  alt={p.title}
                  loading="lazy"
                          decoding="async"
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
          {content.description.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <div>
          <h3 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">
            Posti da visitare
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {content.places.map((pl) => (
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
        {extra}
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </section>
    </div>
    <CountryGuideSections content={content} hideAgentTips={!showAgentTips} />

    </>
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
