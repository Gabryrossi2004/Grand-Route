import { parseLogoShape } from "@/lib/logoShape";
import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { translateItineraryView } from "@/lib/tripTranslation";
import ItineraryTranslator from "@/components/ItineraryTranslator";
import ZefiroClientFloating from "@/components/ZefiroClientFloating";
import { ZefiroDestination, ZefiroStyleProvider } from "@/components/ZefiroStyle";
import { getAvatarStyle } from "@/lib/assistant";
import { resolveTopics } from "@/lib/zefiroTopics";
import { parseAiPlan } from "@/lib/aiPricing";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileWarning } from "lucide-react";
import { loadTripDays } from "@/lib/tripDays";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, ApprovalStatus, Profile, TripDay, TripDocument, TripMessage, TripPayment } from "@/lib/types";
import TripGlance from "@/components/TripGlance";
import ClientDocuments, { type ClientDoc } from "@/components/ClientDocuments";
import ClientTripChat, { ActivityChangeButton, ApprovalBanner } from "@/components/ClientTripChat";
import TripItineraryView from "@/components/TripItineraryView";
import EmergencyButton from "@/components/EmergencyButton";

// Promemoria documenti: mostrato solo se la partenza è vicina e non c'è
// ancora nessun documento d'identità a sistema (né carta d'identità né
// passaporto). Soglia volutamente larga (3 settimane) per lasciare tempo a
// chi deve ancora procurarsi o rinnovare un documento.
const DOCUMENTS_REMINDER_WINDOW_DAYS = 21;

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

// La prima visita in inglese traduce l'itinerario: può richiedere qualche secondo
export const maxDuration = 60;

export default async function ClientTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { t, lang } = await getT();
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

  const [{ data: days }, { data: owner }, { data: incomingPayments }, { data: tripMessages }, { data: sharedDocuments }, { data: zefiroStatus }] = await Promise.all([
    loadTripDays(supabase, trip.id),
    supabase.from("profiles").select("*").eq("id", trip.owner_id).single(),
    supabase.from("trip_payments").select("*").eq("trip_id", trip.id).eq("direction", "incasso"),
    supabase.from("trip_messages").select("*").eq("trip_id", trip.id).order("created_at", { ascending: true }),
    // Solo i documenti che l'agenzia ha reso visibili (lo garantisce il database)
    supabase.from("documents").select("*").eq("trip_id", trip.id).order("uploaded_at", { ascending: true }),
    // Zefiro acceso per questo viaggio? (se lo script 0040 non c'è, resta spento)
    supabase.rpc("client_zefiro_status", { p_trip_id: trip.id }),
  ]);
  const zefiroRow = (zefiroStatus as { enabled: boolean; plan: string }[] | null)?.[0];
  const zefiroEnabled = Boolean(zefiroRow?.enabled);

  const orderedDays = ((days as DayWithActivities[]) || []).map((day) => ({
    ...day,
    activities: (day.activities || []).sort((a, b) => a.activity_order - b.activity_order),
  }));

  // Per chi legge in inglese, i testi dell'itinerario vengono tradotti (una volta sola, poi restano salvati)
  const view = await translateItineraryView(supabase, trip, orderedDays, lang);

  const activityTitles = new Map<string, string>();
  for (const day of view.days) for (const activity of day.activities) activityTitles.set(activity.id, activity.title);
  const clientDocuments: ClientDoc[] = await Promise.all(
    ((sharedDocuments as TripDocument[] | null) ?? []).map(async (document) => {
      const { data } = await supabase.storage.from("trip-documents").createSignedUrl(document.file_path, 60 * 60);
      return {
        id: document.id,
        name: document.file_name,
        url: data?.signedUrl ?? null,
        where: document.activity_id ? (activityTitles.get(document.activity_id) ?? null) : null,
      };
    }),
  );

  const ownerProfile = owner as Profile | null;
  const approvalStatus = (trip.approval_status ?? "none") as ApprovalStatus;
  const stage: "preliminare" | "finale" = trip.itinerary_stage === "finale" ? "finale" : "preliminare";
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
    <ZefiroStyleProvider mode={getAvatarStyle(ownerProfile?.ai_preferences)}>
      <ZefiroDestination destination={trip.destination} title={trip.title} />
      <TripItineraryView
        trip={view.trip}
        days={view.days}
        showPdfButton
        agencyName={ownerProfile?.agency_name}
        logoUrl={ownerProfile?.logo_url}
        logoShape={parseLogoShape(ownerProfile?.logo_shape)}
        agencyTerms={ownerProfile?.terms_and_conditions}
        brandColor={ownerProfile?.brand_color}
        payments={(incomingPayments as TripPayment[]) || []}
        contentTop={
          <>
            {view.needed && <ItineraryTranslator tripId={trip.id} />}
            <Suspense fallback={null}>
              <TripGlance trip={trip} days={orderedDays} />
            </Suspense>
            <ClientDocuments documents={clientDocuments} />
          </>
        }
        // Il pulsante di richiesta modifica serve solo finché l'itinerario è preliminare
        activityAction={stage === "preliminare" ? (activityId) => <ActivityChangeButton activityId={activityId} /> : undefined}
        headerExtra={
          <div className="flex flex-col bg-white/90 backdrop-blur">
            <div className="px-4 py-2">
              <Link
                href="/client"
                className="mx-auto flex max-w-3xl items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft size={14} /> {t("portal.backToTrips")}
              </Link>
            </div>
            <ApprovalBanner approvalStatus={approvalStatus} stage={stage} />
            {showDocumentsReminder && (
              <div className="bg-amber-50 px-4 py-2">
                <Link
                  href="/client/documenti"
                  className="mx-auto flex max-w-3xl items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-900"
                >
                  <FileWarning size={15} className="shrink-0" />
                  {t("portal.docsReminder")}
                </Link>
              </div>
            )}
          </div>
        }
      />
      <ClientTripChat
        tripId={trip.id}
        messages={(tripMessages as TripMessage[] | null) ?? []}
        days={orderedDays.map((day, index) => ({
          id: day.id,
          label: t("trip.day", { n: index + 1 }),
          activities: day.activities.map((activity) => ({ id: activity.id, label: activity.title })),
        }))}
        approvalStatus={approvalStatus}
        agencyLabel={ownerProfile?.agency_name || t("common.agencyDefault")}
        stage={stage}
        zefiroEnabled={zefiroEnabled}
      />
      {zefiroEnabled && (
        <ZefiroClientFloating
          tripId={trip.id}
          topics={resolveTopics(owner?.ai_preferences, parseAiPlan(zefiroRow?.plan))}
          sosVisible={showEmergencyButton}
        />
      )}
      {showEmergencyButton && (
        <EmergencyButton
          tripId={trip.id}
          tripTitle={trip.title}
          clientName={clientName}
          agencyPhone={ownerProfile!.emergency_phone!}
        />
      )}
    </ZefiroStyleProvider>
  );
}
