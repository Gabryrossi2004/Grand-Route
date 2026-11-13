import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, Profile, TripDay } from "@/lib/types";
import PrintButton from "@/components/PrintButton";
import TripItineraryView from "@/components/TripItineraryView";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

export default async function TripPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) notFound();

  const [{ data: days }, { data: owner }] = await Promise.all([
    supabase
      .from("trip_days")
      .select("*, activities(*, activity_photos(*))")
      .eq("trip_id", id)
      .order("day_order", { ascending: true }),
    // Come in /t/[slug]: solo le colonne leggibili senza login
    // (vedi migrazione 0029).
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
      headerExtra={
        <div className="flex justify-center bg-[#faf3e6] px-4 py-3 print:hidden">
          <PrintButton />
        </div>
      }
    />
  );
}
