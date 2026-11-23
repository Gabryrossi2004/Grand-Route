import Link from "next/link";
import { NotebookPen, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { flagOf } from "@/lib/geo/countryCodes";

type Trip = { id: string; title: string; start_date: string | null; end_date: string | null; countries?: string[] | null; auto_countries?: string[] | null };
type Offer = { id: string; title: string; body: string | null; kind?: string; country_code?: string | null; place?: string | null };

// Durante il viaggio: cosa c'è oggi, il diario di oggi e le convenzioni dell'agenzia nei paesi del viaggio
export default async function TodayTripCard({ trip, today }: { trip: Trip; today: string }) {
  const supabase = await createClient();
  const [{ data: day }, { data: benefits }] = await Promise.all([
    supabase.from("trip_days").select("id, title, activities(location, activity_order)").eq("trip_id", trip.id).eq("day_date", today).maybeSingle(),
    supabase.rpc("client_benefits"),
  ]);
  const acts = ((day as { activities?: { location: string | null; activity_order: number }[] } | null)?.activities ?? []).sort((a, b) => a.activity_order - b.activity_order);
  const place = acts.find((a) => a.location)?.location ?? null;
  const countries = new Set([...(trip.countries ?? []), ...(trip.auto_countries ?? [])]);
  const offers = ((benefits as { offers?: Offer[] }[] | null) ?? []).flatMap((b) => b.offers ?? []);
  const norm = (s: string) => s.toLowerCase();
  const deals = offers
    .filter((o) => o.kind === "convenzione" && (!o.country_code || countries.has(o.country_code)))
    .sort((a, b) => Number(Boolean(b.place && place && norm(place).includes(norm(b.place)))) - Number(Boolean(a.place && place && norm(place).includes(norm(a.place)))))
    .slice(0, 3);

  return (
    <section className="mb-8 rounded-3xl border border-[#e3b04b] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">Oggi nel tuo viaggio</p>
      <h2 className="mt-1 text-xl font-semibold text-[#233c5e]">{(day as { title?: string | null } | null)?.title || trip.title}</h2>
      {place && <p className="text-sm text-slate-600">{place}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/client/diario?trip=${trip.id}`} className="flex items-center gap-1.5 rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f]">
          <NotebookPen size={15} /> Scrivi il diario di oggi
        </Link>
        <Link href={`/client/trips/${trip.id}`} className="rounded-full border border-[#e6d7bb] px-4 py-2 text-sm font-medium text-[#233c5e] hover:bg-[#faf3e6]">
          Programma
        </Link>
      </div>
      {deals.length > 0 && (
        <div className="mt-4 border-t border-[#f0e6d2] pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Tag size={14} className="text-[#c58f2d]" /> Le convenzioni della tua agenzia qui
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {deals.map((d) => (
              <li key={d.id}>
                <span className="font-medium text-slate-900">
                  {d.country_code ? `${flagOf(d.country_code)} ` : ""}
                  {d.title}
                </span>
                {d.place && <span className="text-slate-500"> · {d.place}</span>}
                {d.body && <span className="block text-slate-600">{d.body}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
