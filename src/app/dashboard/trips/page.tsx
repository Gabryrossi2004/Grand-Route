import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Trip, TripGroup } from "@/lib/types";
import TripsList from "@/components/TripsList";

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: trips }, { data: groups }] = await Promise.all([
    supabase
      .from("trips")
      .select("*")
      .eq("owner_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("trip_groups")
      .select("*")
      .eq("owner_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="border-l-4 border-[#233c5e] pl-3 text-2xl font-semibold text-slate-900">Viaggi</h1>
        <Link
          href="/dashboard/trips/new"
          className="rounded-lg bg-[#233c5e] px-6 py-3 text-base font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f]"
        >
          + Nuovo viaggio
        </Link>
      </div>

      <TripsList trips={(trips as Trip[]) || []} groups={(groups as TripGroup[]) || []} />
    </div>
  );
}
