import { librarySheet } from "@/lib/countrySheetLibrary";
import { nameItOfCode } from "@/lib/geo/countryCodes";
import { photoSrc } from "@/lib/photoSrc";
import { suggestNextCountries } from "@/lib/nextTrip";
import RequestQuoteButton from "@/components/RequestQuoteButton";

// «Il tuo prossimo viaggio»: tre idee dalla libreria in base ai paesi già visitati (senza AI)
export default function NextTripCard({ visited }: { visited: string[] }) {
  const codes = suggestNextCountries(visited, (c) => Boolean(librarySheet(c)?.content.itineraries?.length));
  if (codes.length === 0) return null;
  const ideas = codes.map((code) => {
    const sheet = librarySheet(code)!;
    const it = sheet.content.itineraries![0];
    return { code, name: nameItOfCode(code), photo: sheet.photos[0]?.url ?? null, tagline: sheet.content.tagline, it };
  });
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-xl font-medium text-[#233c5e]">Il tuo prossimo viaggio</h2>
      <p className="mb-4 text-sm text-slate-600">
        {visited.length ? "Idee scelte in base ai paesi che hai già visitato." : "Qualche idea per la prossima partenza."} La tua agenzia può prepararle su misura per te.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {ideas.map((x) => (
          <article key={x.code} className="flex flex-col overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white">
            <div className="relative h-28 bg-gradient-to-br from-[#243f66] to-[#c58f2d]">
              {x.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoSrc(x.photo)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 font-semibold text-white">{x.name}</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <p className="text-sm font-semibold text-slate-900">
                {x.it.title} <span className="font-normal text-[#a87a1e]">· {x.it.days} giorni</span>
              </p>
              <p className="text-xs text-[#233c5e]">{x.it.route}</p>
              <p className="line-clamp-3 text-xs text-slate-600">{x.it.description}</p>
              <div className="mt-auto pt-2">
                <RequestQuoteButton title={`${x.name}: ${x.it.title} (${x.it.days} giorni)`} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
