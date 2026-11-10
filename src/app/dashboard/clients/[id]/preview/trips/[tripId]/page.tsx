import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, Profile, TripDay } from "@/lib/types";
import TripItineraryView from "@/components/TripItineraryView";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

export default async function ClientPreviewTripPage({
  params,
}: {
  params: Promise<{ id: string; tripId: string }>;
}) {
  const { id, tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .eq("client_id", id)
    .eq("owner_id", user?.id ?? "")
    .single();
  if (!trip) notFound();

  const [{ data: days }, { data: owner }] = await Promise.all([
    supabase
      .from("trip_days")
      .select("*, activities(*, activity_photos(*))")
      .eq("trip_id", trip.id)
      .order("day_order", { ascending: true }),
    supabase.from("profiles").select("*").eq("id", trip.owner_id).single(),
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
        <div className="flex flex-col gap-2 bg-white/90 px-4 py-2 backdrop-blur">
          <Link
            href={`/dashboard/clients/${id}/preview`}
            className="mx-auto flex w-full max-w-3xl items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> I miei viaggi
          </Link>
          <div className="mx-auto flex w-full max-w-3xl items-center gap-1.5 text-xs text-[#17283f]">
            <Eye size={12} className="shrink-0" /> Anteprima in sola lettura
          </div>
        </div>
      }
    />
  );
}
