import { Briefcase, CalendarDays, Compass, MapPinned, Route } from "lucide-react";
import type { CountrySheetContent } from "@/lib/countrySheetAi";
import { MONTHS_LONG, MONTHS_SHORT, SEASON_LEVELS } from "@/lib/countrySheetShared";
import UseItineraryButton from "@/components/UseItineraryButton";
import type { LibraryItinerary } from "@/lib/libraryItinerary";

// Parti "guida" della scheda paese: zone con il calendario mese per mese, cosa fare, itinerari,
// consigli per l'agente (questi ultimi non compaiono nella stampa per il cliente).
export default function CountryGuideSections({
  content,
  hideAgentTips = false,
  useItinerary,
}: {
  content: CountrySheetContent;
  hideAgentTips?: boolean;
  // Solo per l'agenzia: paese (codice e nome) per creare un viaggio da un itinerario
  useItinerary?: { code: string; label: string };
}) {
  const areas = content.areas ?? [];
  const experiences = content.experiences ?? [];
  const itineraries = content.itineraries ?? [];
  const agentTips = hideAgentTips ? [] : (content.agentTips ?? []);
  if (!areas.length && !experiences.length && !itineraries.length && !agentTips.length) return null;

  return (
    <div className="flex flex-col gap-7 border-t border-[#e6d7bb] px-5 pb-6 pt-6 sm:px-6">
      {areas.length > 0 && (
        <section>
          <Title icon={<CalendarDays size={18} />}>Quando andare, zona per zona</Title>
          <div className="overflow-x-auto rounded-2xl border border-[#e6d7bb] bg-white">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#a87a1e]">
                  <th className="px-3 py-2 text-left">Zona</th>
                  {MONTHS_SHORT.map((m, i) => (
                    <th key={i} className="w-9 px-0 py-2 text-center" title={MONTHS_LONG[i]}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.name} className="border-t border-[#f0e6d2]">
                    <td className="px-3 py-1.5 font-medium text-[#1d2b40]">{a.name}</td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const lv = SEASON_LEVELS[(a.seasons ?? "")[i]?.toUpperCase() ?? ""];
                      return (
                        <td key={i} className="p-0.5">
                          <span
                            className="block h-6 rounded"
                            style={{ background: lv?.bg ?? "#f1ede4" }}
                            title={`${MONTHS_LONG[i]}: ${lv?.label ?? "—"}`}
                            aria-label={`${MONTHS_LONG[i]}: ${lv?.label ?? "non indicato"}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
            {Object.entries(SEASON_LEVELS).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-5 rounded" style={{ background: v.bg }} /> {v.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {areas.length > 0 && (
        <section>
          <Title icon={<MapPinned size={18} />}>Le zone del paese</Title>
          <div className="grid gap-3 md:grid-cols-2">
            {areas.map((a) => (
              <article key={a.name} className="flex flex-col gap-2 rounded-2xl border border-[#e6d7bb] bg-white p-4 [break-inside:avoid]">
                <h4 className="font-[family-name:var(--font-display)] text-base font-semibold text-[#233c5e]">{a.name}</h4>
                <div className="flex gap-0.5" aria-hidden>
                  {Array.from({ length: 12 }, (_, i) => {
                    const lv = SEASON_LEVELS[(a.seasons ?? "")[i]?.toUpperCase() ?? ""];
                    return (
                      <span key={i} className="flex-1 rounded-sm text-center text-[9px] font-bold leading-4" style={{ background: lv?.bg ?? "#f1ede4", color: lv?.fg ?? "#6b7280" }}>
                        {MONTHS_SHORT[i]}
                      </span>
                    );
                  })}
                </div>
                <p className="text-xs italic text-slate-500">{a.seasonNote}</p>
                <p className="text-sm leading-relaxed text-slate-700">{a.description}</p>
                {a.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.highlights.map((h) => (
                      <span key={h} className="rounded-full bg-[#f6eedc] px-2 py-0.5 text-xs text-[#5b4a2c]">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {experiences.length > 0 && (
        <section>
          <Title icon={<Compass size={18} />}>Cosa fare</Title>
          <ul className="grid gap-2 sm:grid-cols-2">
            {experiences.map((e) => (
              <li key={e.name} className="rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-sm [break-inside:avoid]">
                <span className="block font-semibold text-[#1d2b40]">{e.name}</span>
                <span className="text-slate-600">{e.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {itineraries.length > 0 && (
        <section>
          <Title icon={<Route size={18} />}>Itinerari consigliati</Title>
          <div className="grid gap-3 md:grid-cols-2">
            {itineraries.map((it) => (
              <article key={it.title} className="rounded-2xl border border-[#e6d7bb] bg-white p-4 [break-inside:avoid]">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-[#1d2b40]">{it.title}</h4>
                  <span className="shrink-0 rounded-full bg-[#233c5e] px-2.5 py-0.5 text-xs font-bold text-white">{it.days} giorni</span>
                </div>
                <p className="mt-1 text-sm font-medium text-[#a87a1e]">{it.route}</p>
                <p className="mt-1 text-sm text-slate-600">{it.description}</p>
                {"plan" in it && Array.isArray((it as LibraryItinerary).plan) && (
                  <p className="mt-1 text-xs font-medium text-emerald-700">Programma giorno per giorno già pronto</p>
                )}
                {useItinerary && <UseItineraryButton kind="country" code={useItinerary.code} label={useItinerary.label} itinerary={it as LibraryItinerary} />}
              </article>
            ))}
          </div>
        </section>
      )}

      {agentTips.length > 0 && (
        <section className="rounded-2xl border-2 border-[#233c5e] bg-[#eef2f8] p-4 print:hidden">
          <Title icon={<Briefcase size={18} />}>Consigli per l&apos;agente</Title>
          <p className="-mt-1 mb-2 text-xs text-slate-500">Solo per te: questa parte non compare nella stampa per il cliente.</p>
          <ul className="flex flex-col gap-1.5 text-sm text-slate-700">
            {agentTips.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#233c5e]" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Title({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-semibold text-[#233c5e]">
      <span className="text-[#c58f2d]">{icon}</span>
      {children}
    </h3>
  );
}
