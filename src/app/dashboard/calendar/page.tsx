import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";
import DepartureCalendar from "@/components/DepartureCalendar";

export default async function CalendarPage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("owner_id", user?.id ?? "")
    .order("start_date", { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="border-l-4 border-[#233c5e] pl-3 text-2xl font-semibold text-slate-900">Calendario delle partenze</h1>
        <p className="text-sm text-slate-500">Tutte le partenze (✈) e i rientri (↩) dei tuoi viaggi, mese per mese.</p>
      </div>

      <DepartureCalendar trips={(trips as Trip[]) || []} />
    </div>
  );
}
