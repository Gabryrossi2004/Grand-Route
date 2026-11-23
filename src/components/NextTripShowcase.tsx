"use client";

import { useRef, useState } from "react";
import { CalendarHeart, Lightbulb, MapPinned, Plane, Sparkles, Sun } from "lucide-react";
import RequestQuoteButton from "@/components/RequestQuoteButton";

export type NextTripIdea = {
  code: string;
  name: string;
  because: string | null;
  tagline: string;
  photos: { src: string; title: string; credit: string; license: string; source: string }[];
  facts: string[];
  experiences: string[];
  bestPeriod: string;
  flight: string;
  season: { now: boolean; text: string } | null;
  itinerary: { title: string; days: number; route: string; description: string };
};

function Photo({ src, className = "" }: { src?: string; className?: string }) {
  return (
    <div className={`overflow-hidden bg-gradient-to-br from-[#243f66] to-[#c58f2d] ${className}`}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
    </div>
  );
}

// La meta in primo piano (foto grandi, curiosità, stagione, itinerario) e le altre idee da sfogliare
export default function NextTripShowcase({ ideas, hasVisited }: { ideas: NextTripIdea[]; hasVisited: boolean }) {
  const [active, setActive] = useState(0);
  const topRef = useRef<HTMLElement>(null);
  const x = ideas[active];
  const [main, ...rest] = x.photos;

  return (
    <section ref={topRef} className="mt-12 scroll-mt-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a87a1e]">Idee per te</p>
      <h2 className="mt-1 text-2xl text-[#233c5e] sm:text-3xl">Il tuo prossimo viaggio</h2>
      <p className="mb-5 mt-1 text-base text-slate-600">
        {hasVisited ? "Scelto in base ai paesi che hai già visitato." : "Qualche idea per la prossima partenza."} La tua agenzia lo prepara su misura per te.
      </p>

      <article key={x.code} className="gr-fade overflow-hidden rounded-3xl border border-[#e6d7bb] bg-white shadow-sm">
        {/* Foto: una grande con il nome della meta, le altre accanto (o sotto, sul telefono) */}
        <div className="grid gap-1 sm:h-[440px] sm:grid-cols-3 sm:grid-rows-2">
          <div className="relative h-80 sm:col-span-2 sm:row-span-2 sm:h-auto">
            <Photo src={main?.src} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
            {x.season && (
              <span
                className={`absolute left-4 top-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow ${
                  x.season.now ? "bg-[#f2c14e] text-[#3a2a06]" : "bg-white/90 text-[#233c5e]"
                }`}
              >
                <Sun size={15} /> {x.season.text}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              {x.because && (
                <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-white/85">
                  <Sparkles size={14} /> Ispirata al tuo viaggio: {x.because}
                </p>
              )}
              <h3 className="text-4xl leading-tight text-white drop-shadow sm:text-5xl">{x.name}</h3>
              <p className="mt-2 max-w-xl text-lg italic leading-snug text-white/90">{x.tagline}</p>
            </div>
          </div>
          {rest.length > 0 && (
            <div className="grid grid-cols-3 gap-1 sm:contents">
              {rest.slice(0, 3).map((p, i) => (
                <div key={p.src} className={`relative h-24 sm:h-auto ${i === 2 ? "sm:hidden" : ""}`}>
                  <Photo src={p.src} className="absolute inset-0" />
                  <span className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-sm font-medium text-white sm:block">
                    {p.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-[1.15fr_1fr] sm:p-7">
          <div className="space-y-5">
            {x.facts.length > 0 && (
              <div className="rounded-2xl border-l-4 border-[#c58f2d] bg-[#fbf6ec] p-4">
                <p className="mb-2 flex items-center gap-2 text-base font-semibold text-[#8a6418]">
                  <Lightbulb size={18} /> Lo sapevi?
                </p>
                <ul className="space-y-2 text-base leading-relaxed text-slate-700">
                  {x.facts.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c58f2d]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {x.experiences.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">Da vivere</p>
                <div className="flex flex-wrap gap-2">
                  {x.experiences.map((e) => (
                    <span key={e} className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 text-sm text-[#233c5e]">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <p className="flex gap-3 text-base text-slate-700">
              <CalendarHeart size={20} className="mt-0.5 shrink-0 text-[#c58f2d]" />
              <span>
                <span className="block text-sm font-semibold text-slate-500">Quando andare</span>
                {x.bestPeriod}
              </span>
            </p>
            <p className="flex gap-3 text-base text-slate-700">
              <Plane size={20} className="mt-0.5 shrink-0 text-[#c58f2d]" />
              <span>
                <span className="block text-sm font-semibold text-slate-500">Volo dall&apos;Italia</span>
                {x.flight}
              </span>
            </p>
            <div className="flex gap-3 text-base text-slate-700">
              <MapPinned size={20} className="mt-0.5 shrink-0 text-[#c58f2d]" />
              <div>
                <span className="block text-sm font-semibold text-slate-500">Un itinerario per iniziare</span>
                <p className="font-semibold text-slate-900">
                  {x.itinerary.title} <span className="font-normal text-[#a87a1e]">· {x.itinerary.days} giorni</span>
                </p>
                <p className="text-sm text-[#233c5e]">{x.itinerary.route}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{x.itinerary.description}</p>
              </div>
            </div>
            <div className="mt-auto pt-2">
              <RequestQuoteButton size="lg" title={`${x.name}: ${x.itinerary.title} (${x.itinerary.days} giorni)`} />
            </div>
          </div>
        </div>
        {x.photos.length > 0 && (
          <p className="px-5 pb-4 text-xs text-slate-400 sm:px-7">
            Foto: {[...new Set(x.photos.map((p) => p.credit))].join(", ")} · Wikimedia Commons
          </p>
        )}
      </article>

      {ideas.length > 1 && (
        <>
          <p className="mb-3 mt-8 text-lg font-semibold text-[#233c5e]">Altre idee per te</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {ideas.map((o, i) =>
              i === active ? null : (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => {
                    setActive(i);
                    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="group overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative h-44">
                    <Photo src={o.photos[0]?.src} className="absolute inset-0" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-3 left-4 text-2xl font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                      {o.name}
                    </span>
                    {o.season?.now && (
                      <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-[#f2c14e] px-2.5 py-1 text-xs font-semibold text-[#3a2a06]">
                        <Sun size={12} /> Stagione perfetta
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-base text-slate-700">{o.tagline}</p>
                    {o.facts[0] && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                        <span className="font-semibold text-[#8a6418]">Lo sapevi? </span>
                        {o.facts[0]}
                      </p>
                    )}
                    <p className="mt-3 text-sm font-semibold text-[#233c5e]">Scopri di più →</p>
                  </div>
                </button>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}
