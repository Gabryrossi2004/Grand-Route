import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, Profile, TripDay } from "@/lib/types";
import TripItineraryView from "@/components/TripItineraryView";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

export default async function PublicTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("public_slug", slug)
    .eq("is_published", true)
    .single();

  if (!trip) notFound();

  const [{ data: days }, { data: owner }] = await Promise.all([
    supabase
      .from("trip_days")
      .select("*, activities(*, activity_photos(*))")
      .eq("trip_id", trip.id)
      .order("day_order", { ascending: true }),
    // Solo le colonne che un visitatore non registrato può leggere
    // (vedi migrazione 0029): non "*", che includerebbe email e
    // recapiti dell'agenzia e verrebbe rifiutato dal database.
    supabase.from("profiles").select("agency_name, logo_url, terms_and_conditions").eq("id", trip.owner_id).single(),
  ]);

  const orderedDays = ((days as DayWithActivities[]) || []).map((day) => ({
    ...day,
    activities: (day.activities || []).sort((a, b) => a.activity_order - b.activity_order),
  }));

  return (
    <TripItineraryView
      trip={trip}
      days={orderedDays}
      agencyName={(owner as Profile | null)?.agency_name}
      logoUrl={(owner as Profile | null)?.logo_url}
      agencyTerms={(owner as Profile | null)?.terms_and_conditions}
    />
  );
}
