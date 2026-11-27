import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext, getTeamPeople } from "@/lib/team";
import type { Trip, TripGroup } from "@/lib/types";
import TripsList from "@/components/TripsList";

export default async function TripsPage() {
  const supabase = await createClient();
  // Dati dell'agenzia (per un collaboratore: quelli dell'agenzia in cui lavora)
  const team = await getTeamContext();
  const companyId = team?.companyId ?? "";
  // con il team: filtro «I miei viaggi» e chi segue ogni viaggio
  const people = await getTeamPeople();

  const [{ data: trips }, { data: groups }] = await Promise.all([
    supabase
      .from("trips")
      .select("*, trip_days(count)")
      .eq("owner_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("trip_groups")
      .select("*")
      .eq("owner_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  const tripsWithDayCount = ((trips as (Trip & { trip_days?: { count: number }[] })[]) || []).map(({ trip_days, ...trip }) => ({
    ...trip,
    day_count: trip_days?.[0]?.count ?? undefined,
  })) as Trip[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Viaggi</h1>
        <Link
          href="/dashboard/trips/new"
          className="rounded-lg bg-[#233c5e] px-6 py-3 text-base font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f]"
        >
          + Nuovo viaggio
        </Link>
      </div>

      <TripsList
        trips={tripsWithDayCount}
        groups={(groups as TripGroup[]) || []}
        team={team && people.length > 0 ? { userId: team.userId, names: Object.fromEntries(people.map((p) => [p.id, p.name])) } : null}
      />
    </div>
  );
}
