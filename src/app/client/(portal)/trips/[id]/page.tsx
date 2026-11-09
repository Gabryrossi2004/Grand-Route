import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, Profile, TripDay } from "@/lib/types";
import TripItineraryView from "@/components/TripItineraryView";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

export default async function ClientTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myClientRows } = await supabase.from("clients").select("id").eq("user_id", user?.id ?? "");
  const clientIds = (myClientRows || []).map((row) => row.id);
  if (clientIds.length === 0) notFound();

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).in("client_id", clientIds).single();
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
        <div className="bg-white/90 px-4 py-2 backdrop-blur">
          <Link
            href="/client"
            className="mx-auto flex max-w-3xl items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> I miei viaggi
          </Link>
        </div>
      }
    />
  );
}
