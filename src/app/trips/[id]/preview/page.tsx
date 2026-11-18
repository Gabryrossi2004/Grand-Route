import { fetchLogoShape } from "@/lib/logoShape";
import { notFound } from "next/navigation";
import { loadTripDays } from "@/lib/tripDays";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, Profile, TripDay } from "@/lib/types";
import PrintButton from "@/components/PrintButton";
import AutoPrint from "@/components/AutoPrint";
import TripItineraryView from "@/components/TripItineraryView";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

export default async function TripPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pdf?: string }>;
}) {
  const { id } = await params;
  const { pdf } = await searchParams;
  const supabase = await createClient();

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) notFound();

  const [{ data: days }, { data: owner }] = await Promise.all([
    loadTripDays(supabase, id),
    // Come in /t/[slug]: solo le colonne leggibili senza login
    // (vedi migrazione 0029).
    supabase.from("profiles").select("agency_name, logo_url, terms_and_conditions, brand_color").eq("id", trip.owner_id).single(),
  ]);

  const logoShape = await fetchLogoShape(supabase, trip.owner_id);

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
      logoShape={logoShape}
      agencyTerms={(owner as Profile | null)?.terms_and_conditions}
      brandColor={(owner as Profile | null)?.brand_color}
      headerExtra={
        <div className="flex justify-center bg-[#faf3e6] px-4 py-3 print:hidden">
          <PrintButton />
          {pdf === "1" && <AutoPrint />}
        </div>
      }
    />
  );
}
