import { notFound } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { matchLibrary } from "@/lib/libraryProposals";
import { librarySheet } from "@/lib/countrySheetLibrary";
import TripHeader from "../TripHeader";
import PackingList, { type PackRow } from "./PackingList";

export const metadata = { title: "Valigia" };

export default async function PackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCachedUser();
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, title, destination, start_date, end_date").eq("id", id).eq("owner_id", user?.id ?? "").maybeSingle();
  if (!trip) notFound();

  const [{ count: days }, itemsRes] = await Promise.all([
    supabase.from("trip_days").select("id", { count: "exact", head: true }).eq("trip_id", id),
    supabase.from("trip_packing_items").select("id, text, category, done, item_order").eq("trip_id", id).order("item_order"),
  ]);

  // Cose da sapere sul paese (dalla libreria Grand Route): prese, documenti, moneta, fuso
  let country: { name: string; plugs: string; documents: string; currency: string; timezone: string } | null = null;
  const match = trip.destination ? matchLibrary(trip.destination) : null;
  if (match?.kind === "country") {
    const facts = librarySheet(match.key)?.content.facts;
    if (facts) country = { name: match.label, plugs: facts.plugs, documents: facts.documents, currency: facts.currency, timezone: facts.timezone };
  }

  return (
    <div className="flex flex-col gap-5">
      <TripHeader trip={trip} active="valigia" />
      <PackingList
        tripId={id}
        days={days ?? 5}
        initial={(itemsRes.data as PackRow[] | null) ?? []}
        notReady={Boolean(itemsRes.error)}
        country={country}
      />
    </div>
  );
}
