import { notFound } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import TripHeader from "../TripHeader";
import ShareToggle from "./ShareToggle";

export const metadata = { title: "Condividi" };

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCachedUser();
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("id, title, destination, start_date, end_date, public_slug, is_published").eq("id", id).eq("owner_id", user?.id ?? "").maybeSingle();
  if (!trip) notFound();
  return (
    <div className="flex flex-col gap-5">
      <TripHeader trip={trip} active="condividi" />
      <ShareToggle tripId={trip.id} slug={trip.public_slug} initialOn={Boolean(trip.is_published)} title={trip.title} />
    </div>
  );
}
