import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { romeToday } from "@/lib/destinationInfo";
import { flagOf, nameItOfCode, namesOf } from "@/lib/geo/countryCodes";
import JournalPanel from "@/components/JournalPanel";

export const metadata = { title: "Il diario di oggi" };

type TripRow = { id: string; title: string; start_date: string | null; end_date: string | null; countries: string[] | null; auto_countries: string[] | null };

// Il diario di oggi (dalla notifica della sera o dalla Home durante il viaggio): luogo già compilato
export default async function DiaryTodayPage({ searchParams }: { searchParams: Promise<{ trip?: string; c?: string }> }) {
  const { trip: tripId, c } = await searchParams;
  const supabase = await createClient();
  const user = await getCachedUser();
  const today = romeToday();
  const { data: myClients } = await supabase.from("clients").select("id").eq("user_id", user?.id ?? "");
  const ids = (myClients ?? []).map((r) => r.id as string);
  const { data: rows } = ids.length
    ? await supabase.from("trips").select("id, title, start_date, end_date, countries, auto_countries").in("client_id", ids).order("start_date", { ascending: false })
    : { data: [] };
  const trips = (rows as TripRow[] | null) ?? [];
  const trip =
    trips.find((t) => t.id === tripId) ?? trips.find((t) => t.start_date && t.end_date && t.start_date <= today && t.end_date >= today) ?? trips[0];
  if (!trip) {
    return <p className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-6 text-sm text-slate-600">Il diario si apre quando la tua agenzia ti assegna un viaggio.</p>;
  }
  const codes = [...new Set([...(trip.countries ?? []), ...(trip.auto_countries ?? [])])].filter((x) => namesOf(x).length);
  const code = codes.includes(String(c ?? "").toUpperCase()) ? String(c).toUpperCase() : codes[0];
  const { data: day } = await supabase.from("trip_days").select("title, activities(location, activity_order)").eq("trip_id", trip.id).eq("day_date", today).maybeSingle();
  const acts = ((day as { activities?: { location: string | null; activity_order: number }[] } | null)?.activities ?? []).sort((a, b) => a.activity_order - b.activity_order);
  const place = acts.find((a) => a.location)?.location ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">{trip.title}</p>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Il diario di oggi</h1>
        <p className="mt-1 text-sm text-slate-600">Due righe adesso valgono tanto tra qualche anno: cosa hai visto, mangiato, chi hai incontrato. Le note sono private e le ritrovi nel tuo mappamondo.</p>
      </div>
      {codes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {codes.map((x) => (
            <Link
              key={x}
              href={`/client/diario?trip=${trip.id}&c=${x}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${x === code ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#6b5f4a]"}`}
            >
              {flagOf(x)} {nameItOfCode(x)}
            </Link>
          ))}
        </div>
      )}
      {code ? (
        <JournalPanel
          key={code}
          country={namesOf(code)[0]}
          trips={[{ id: trip.id, title: trip.title, from: trip.start_date, status: "current" }]}
          initialPlace={place}
        />
      ) : (
        <p className="text-sm text-slate-600">Il diario sarà disponibile quando la tua agenzia avrà completato le tappe del viaggio.</p>
      )}
    </div>
  );
}
