import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileWarning } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, Profile, TripDay, TripPayment } from "@/lib/types";
import TripItineraryView from "@/components/TripItineraryView";
import EmergencyButton from "@/components/EmergencyButton";

// Promemoria documenti: mostrato solo se la partenza è vicina e non c'è
// ancora nessun documento d'identità a sistema (né carta d'identità né
// passaporto). Soglia volutamente larga (3 settimane) per lasciare tempo a
// chi deve ancora procurarsi o rinnovare un documento.
const DOCUMENTS_REMINDER_WINDOW_DAYS = 21;

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

export default async function ClientTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: myClientRows } = await supabase
    .from("clients")
    .select("id, full_name, id_card_number, passport_number")
    .eq("user_id", user?.id ?? "");
  const clientIds = (myClientRows || []).map((row) => row.id);
  if (clientIds.length === 0) notFound();

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).in("client_id", clientIds).single();
  if (!trip) notFound();

  const myClient = (myClientRows || []).find((row) => row.id === trip.client_id);
  const clientName = myClient?.full_name || "Il cliente";
  const hasIdentityDocument = Boolean(myClient?.id_card_number || myClient?.passport_number);

  const [{ data: days }, { data: owner }, { data: incomingPayments }] = await Promise.all([
    supabase
      .from("trip_days")
      .select("*, activities(*, activity_photos(*))")
      .eq("trip_id", trip.id)
      .order("day_order", { ascending: true }),
    supabase.from("profiles").select("*").eq("id", trip.owner_id).single(),
    supabase.from("trip_payments").select("*").eq("trip_id", trip.id).eq("direction", "incasso"),
  ]);

  const orderedDays = ((days as DayWithActivities[]) || []).map((day) => ({
    ...day,
    activities: (day.activities || []).sort((a, b) => a.activity_order - b.activity_order),
  }));

  const ownerProfile = owner as Profile | null;
  const showEmergencyButton = trip.show_emergency_button && Boolean(ownerProfile?.emergency_phone);

  const daysUntilDeparture = trip.start_date
    ? Math.ceil((new Date(trip.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const showDocumentsReminder =
    !hasIdentityDocument &&
    daysUntilDeparture !== null &&
    daysUntilDeparture >= 0 &&
    daysUntilDeparture <= DOCUMENTS_REMINDER_WINDOW_DAYS;

  return (
    <>
      <TripItineraryView
        trip={trip}
        days={orderedDays}
        agencyName={ownerProfile?.agency_name}
        logoUrl={ownerProfile?.logo_url}
        agencyTerms={ownerProfile?.terms_and_conditions}
        brandColor={ownerProfile?.brand_color}
        payments={(incomingPayments as TripPayment[]) || []}
        headerExtra={
          <div className="flex flex-col bg-white/90 backdrop-blur">
            <div className="px-4 py-2">
              <Link
                href="/client"
                className="mx-auto flex max-w-3xl items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft size={14} /> I miei viaggi
              </Link>
            </div>
            {showDocumentsReminder && (
              <div className="bg-amber-50 px-4 py-2">
                <Link
                  href="/client/documenti"
                  className="mx-auto flex max-w-3xl items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-900"
                >
                  <FileWarning size={15} className="shrink-0" />
                  La partenza si avvicina: completa i tuoi dati del documento d&apos;identità
                </Link>
              </div>
            )}
          </div>
        }
      />
      {showEmergencyButton && (
        <EmergencyButton
          tripId={trip.id}
          tripTitle={trip.title}
          clientName={clientName}
          agencyPhone={ownerProfile!.emergency_phone!}
        />
      )}
    </>
  );
}
