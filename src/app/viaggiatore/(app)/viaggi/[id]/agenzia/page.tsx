import { notFound } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { matchLibrary } from "@/lib/libraryProposals";
import TripHeader from "../TripHeader";
import AgencyRequest, { type AgencyCard, type RequestRow } from "./AgencyRequest";

export const metadata = { title: "Fallo preparare da un'agenzia" };

export default async function AgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCachedUser();
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, title, destination, start_date, end_date").eq("id", id).eq("owner_id", user?.id ?? "").maybeSingle();
  if (!trip) notFound();

  const [agenciesRes, requestsRes] = await Promise.all([supabase.rpc("list_agencies_for_travelers"), supabase.rpc("my_traveler_requests")]);
  const notReady = Boolean(agenciesRes.error);
  const match = trip.destination ? matchLibrary(trip.destination) : null;
  const tripCountry = match?.kind === "country" ? match.key : null;
  const agencies = ((agenciesRes.data as AgencyCard[] | null) ?? [])
    .map((a) => ({ ...a, countries: a.countries ?? [] }))
    .sort((a, b) => Number(tripCountry ? b.countries.includes(tripCountry) : 0) - Number(tripCountry ? a.countries.includes(tripCountry) : 0));
  const requests = ((requestsRes.data as (RequestRow & { trip_id: string | null })[] | null) ?? []).filter((r) => r.trip_id === id);

  return (
    <div className="flex flex-col gap-5">
      <TripHeader trip={trip} active="agenzia" />
      <AgencyRequest tripId={id} tripCountry={tripCountry} agencies={agencies} requests={requests} notReady={notReady} defaultContact={user?.email ?? ""} />
    </div>
  );
}
