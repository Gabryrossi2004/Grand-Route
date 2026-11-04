import { createClient } from "@/lib/supabase/server";
import ClientTripsGrid, { type TripWithAgency } from "@/components/ClientTripsGrid";

export default async function ClientHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myClientRows } = await supabase.from("clients").select("id").eq("user_id", user?.id ?? "");
  const clientIds = (myClientRows || []).map((row) => row.id);

  const { data: trips } =
    clientIds.length > 0
      ? await supabase
          .from("trips")
          .select("*, profiles(agency_name, logo_url)")
          .in("client_id", clientIds)
          .order("start_date", { ascending: false })
      : { data: [] };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">I miei viaggi</h1>
      <ClientTripsGrid
        trips={(trips as TripWithAgency[]) || []}
        tripHref={(tripId) => `/client/trips/${tripId}`}
        emptyMessage="Non abbiamo ancora trovato nessun viaggio collegato alla tua email."
        emptyHint="Appena la tua agenzia lo collegherà al tuo nominativo, lo vedrai comparire qui."
      />
    </div>
  );
}
