import { createClient, getCachedUser } from "@/lib/supabase/server";
import ClientTripsGrid, { type TripWithAgency } from "@/components/ClientTripsGrid";

export default async function ClientHomePage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  let firstName: string | null = null;
  if (user) {
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    firstName = me?.full_name?.split(" ")[0] ?? null;
  }

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
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#233c5e] to-[#34527c] px-7 py-9 text-white">
        <div className="pointer-events-none absolute -right-14 -top-14 h-56 w-56 rounded-full bg-[#cda876]/25" />
        <p className="eyebrow !text-white/70">{firstName ? `Ciao, ${firstName}` : "Benvenuto"}</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-white sm:text-4xl">I tuoi viaggi</h1>
        <p className="mt-2 max-w-md text-sm text-[#d9cdb4]">
          Itinerari, documenti e scadenze del tuo viaggio, sempre a portata di mano.
        </p>
      </div>
      <ClientTripsGrid
        trips={(trips as TripWithAgency[]) || []}
        tripHref={(tripId) => `/client/trips/${tripId}`}
        emptyMessage="Non abbiamo ancora trovato nessun viaggio collegato alla tua email."
        emptyHint="Appena la tua agenzia lo collegherà al tuo nominativo, lo vedrai comparire qui."
      />
    </div>
  );
}
