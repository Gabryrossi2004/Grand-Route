import AskMappamondo from "@/components/AskMappamondo";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { fillMissingCountries } from "@/lib/tripCountries";
import AgencyGlobeView, { type AgencyTrip } from "@/components/AgencyGlobeView";

// La prima apertura ricava i paesi dei viaggi dalle località degli itinerari (poi restano salvati),
// e la scheda paese con Zefiro richiede qualche secondo.
export const maxDuration = 60;

const PER_LOAD = 30; // viaggi da analizzare per apertura (gli altri alla successiva)

type TripRow = {
  id: string;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  countries: string[] | null;
  auto_countries: string[] | null;
  itinerary_stage: string | null;
  approval_status: string | null;
  clients: { full_name: string | null } | null;
};

export default async function AgencyGlobePage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, countries, auto_countries, itinerary_stage, approval_status, clients(full_name)")
    .eq("owner_id", user.id)
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error) {
    console.error("[mappamondo agenzia]", error.message);
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Mappamondo</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Per attivare il mappamondo dell&apos;agenzia serve un aggiornamento del database: esegui lo script <strong>0045_agency_globe.sql</strong> nell&apos;SQL Editor di Supabase, poi ricarica questa pagina.
        </div>
      </div>
    );
  }
  const rows = (data ?? []) as unknown as TripRow[];

  // Paesi ricavati dall'itinerario: si calcolano solo quelli mancanti (poi restano salvati
  // e si azzerano da soli quando l'itinerario cambia)
  await fillMissingCountries(supabase, rows, PER_LOAD);
  const pending = rows.filter((t) => t.auto_countries === null).length;

  // Incassi: un viaggio è "saldato" quando ha incassi registrati e sono tutti pagati
  const { data: payments } = await supabase.from("trip_payments").select("trip_id, amount, paid_date").eq("direction", "incasso").limit(20000);
  const byTrip = new Map<string, { total: number; paid: number; open: number }>();
  for (const p of (payments ?? []) as { trip_id: string; amount: number | string; paid_date: string | null }[]) {
    const e = byTrip.get(p.trip_id) ?? { total: 0, paid: 0, open: 0 };
    const amount = Number(p.amount) || 0;
    e.total += amount;
    if (p.paid_date) e.paid += amount;
    else e.open += 1;
    byTrip.set(p.trip_id, e);
  }

  const trips: AgencyTrip[] = rows.map((t) => {
    const pay = byTrip.get(t.id);
    const countries = [...new Set([...(t.countries ?? []), ...(t.auto_countries ?? [])].map((c) => c.toUpperCase()))];
    return {
      id: t.id,
      title: t.title,
      client: t.clients?.full_name ?? null,
      from: t.start_date,
      countries,
      confirmed: t.itinerary_stage === "finale" || t.approval_status === "approved",
      paid: !!pay && pay.total > 0 && pay.open === 0,
      value: pay?.total ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Mappamondo</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Dove hai venduto i tuoi viaggi, paese per paese. Tocca un paese per vedere i viaggi e aprire la <strong>scheda paese</strong> da presentare ai clienti.
        </p>
      </div>
      <AgencyGlobeView trips={trips} pending={pending} />
      <div className="max-w-2xl">
        <AskMappamondo />
      </div>
    </div>
  );
}
