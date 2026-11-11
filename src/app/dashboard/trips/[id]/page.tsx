import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type {
  Activity,
  ActivityPhoto,
  ActivityTemplate,
  Profile,
  PromptStyle,
  Supplier,
  Trip,
  TripChecklistItem,
  TripDay,
  TripDocument,
  TripPayment,
  TripService,
} from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  MapPin,
  Rocket,
} from "lucide-react";
import AiItineraryGenerator from "@/components/AiItineraryGenerator";
import DocumentRow from "@/components/DocumentRow";
import DropzoneUpload from "@/components/DropzoneUpload";
import EmergencyButtonForm from "@/components/EmergencyButtonForm";
import ExpandableSection from "@/components/ExpandableSection";
import ItineraryEditor from "@/components/ItineraryEditor";
import LibraryPanel from "@/components/LibraryPanel";
import RateBlockForm from "@/components/RateBlockForm";
import SubmitButton from "@/components/SubmitButton";
import TripPriceFields from "@/components/TripPriceFields";
import ThemePicker from "@/components/ThemePicker";
import TitleColorField from "@/components/TitleColorField";
import TripChecklist from "@/components/TripChecklist";
import TripTitleEditor from "@/components/TripTitleEditor";
import TripServicesPanel from "@/components/TripServicesPanel";
import {
  deleteDocument,
  duplicateTripAsVariant,
  togglePublish,
  updateItineraryStage,
  updateTripInfo,
  uploadCover,
  uploadDocument,
} from "./actions";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user?.id ?? "")
    .single();
  if (!trip) notFound();

  const [
    { data: days },
    { data: templates },
    { data: checklistItems },
    { data: tripServices },
    { data: suppliers },
    { data: tripPayments },
    { data: ownerProfile },
    { data: documents },
    { data: promptStyles },
    { data: variantTrips },
  ] = await Promise.all([
    supabase
      .from("trip_days")
      .select("*, activities(*, activity_photos(*))")
      .eq("trip_id", id)
      .order("day_order", { ascending: true }),
    supabase.from("activity_templates").select("*").order("title", { ascending: true }),
    supabase
      .from("trip_checklist_items")
      .select("*")
      .eq("trip_id", id)
      .order("item_order", { ascending: true }),
    supabase
      .from("trip_services")
      .select("*")
      .eq("trip_id", id)
      .order("service_order", { ascending: true }),
    supabase.from("suppliers").select("*").eq("owner_id", user?.id ?? "").order("full_name", { ascending: true }),
    supabase.from("trip_payments").select("*").eq("trip_id", id).order("due_date", { ascending: true }),
    supabase.from("profiles").select("*").eq("id", user?.id ?? "").single(),
    supabase.from("documents").select("*").eq("trip_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("prompt_styles").select("*").eq("owner_id", user?.id ?? "").order("created_at", { ascending: true }),
    trip.group_id
      ? supabase
          .from("trips")
          .select("id, title, is_published")
          .eq("group_id", trip.group_id)
          .neq("id", id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; title: string; is_published: boolean }[] }),
  ]);

  const orderedDays = ((days as DayWithActivities[]) || []).map((day) => ({
    ...day,
    activities: (day.activities || []).sort((a, b) => a.activity_order - b.activity_order),
  }));

  const activityOptions = orderedDays.flatMap((day, dayIndex) =>
    day.activities.map((activity) => ({
      id: activity.id,
      label: `Giorno ${dayIndex + 1} — ${activity.title}`,
    })),
  );

  const host = (await headers()).get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const publicUrl = `${protocol}://${host}/t/${trip.public_slug}`;

  const allDocumentsWithUrl = await Promise.all(
    ((documents as TripDocument[]) || []).map(async (document) => {
      const { data } = await supabase.storage
        .from("trip-documents")
        .createSignedUrl(document.file_path, 60 * 10);
      const coverUrl = document.cover_image_path
        ? (await supabase.storage.from("trip-documents").createSignedUrl(document.cover_image_path, 60 * 10)).data
            ?.signedUrl ?? null
        : null;
      return { ...document, signedUrl: data?.signedUrl ?? null, coverUrl };
    }),
  );

  const documentsWithUrl = allDocumentsWithUrl.filter((document) => !document.activity_id);

  const documentsByActivity: Record<string, typeof allDocumentsWithUrl> = {};
  for (const document of allDocumentsWithUrl) {
    if (!document.activity_id) continue;
    (documentsByActivity[document.activity_id] ??= []).push(document);
  }

  return (
    <div className="flex flex-col gap-8">
      <CoverHero
        trip={trip}
        publicUrl={publicUrl}
        services={(tripServices as TripService[]) || []}
        suppliers={(suppliers as Supplier[]) || []}
        payments={(tripPayments as TripPayment[]) || []}
        activityOptions={activityOptions}
        variantTrips={variantTrips || []}
      />
      <div className="flex flex-wrap items-start gap-4">
        <TripInfoForm trip={trip} />

        <ExpandableSection
          title="Tariffa & Termini"
          badge={
            trip.show_rate_block && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-green-700">
                visibile al cliente
              </span>
            )
          }
        >
          <RateBlockForm trip={trip} hasAgencyTerms={Boolean((ownerProfile as Profile | null)?.terms_and_conditions)} />
        </ExpandableSection>

        <ExpandableSection
          title="Emergenza"
          badge={
            trip.show_emergency_button && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-green-700">
                visibile al cliente
              </span>
            )
          }
        >
          <EmergencyButtonForm trip={trip} hasEmergencyPhone={Boolean((ownerProfile as Profile | null)?.emergency_phone)} />
        </ExpandableSection>

        <TripChecklist tripId={id} items={(checklistItems as TripChecklistItem[]) || []} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white shadow-md shadow-[#e6d7bb]/30">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#233c5e] via-[#333d4a] to-[#17283f] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Itinerario</h2>
            <p className="text-xs text-[#cbd1d8]">Il cuore del viaggio: giorni, attività e dettagli per il cliente.</p>
          </div>
          {orderedDays.length === 0 && (
            <AiItineraryGenerator tripId={id} promptStyles={(promptStyles as PromptStyle[]) || []} />
          )}
        </div>
        <div className="flex flex-col items-stretch gap-3 bg-gradient-to-b from-white to-[#fbf7ec] p-5 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <ItineraryEditor
              tripId={id}
              days={orderedDays}
              templates={(templates as ActivityTemplate[]) || []}
              documentsByActivity={documentsByActivity}
            />
          </div>
          <LibraryPanel templates={(templates as ActivityTemplate[]) || []} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <FileText size={18} className="text-slate-400" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Documenti del viaggio</h2>
            <p className="text-sm text-slate-500">
              Passaporto, visti e documenti di ingresso. Biglietti e voucher si caricano invece dentro ogni
              singola attività, nell&apos;itinerario qui sopra.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
          {documentsWithUrl.length === 0 ? (
            <p className="mb-4 text-sm text-slate-400">Nessun documento caricato ancora.</p>
          ) : (
            <ul className="mb-4 flex flex-col gap-2">
              {documentsWithUrl.map((document) => (
                <DocumentRow key={document.id} tripId={id} document={document} />
              ))}
            </ul>
          )}

          <form
            action={uploadDocument.bind(null, id, null)}
            encType="multipart/form-data"
            className="border-t border-slate-100 pt-4"
          >
            <DropzoneUpload name="file" label="Carica passaporto, visto o altro documento" />
          </form>
        </div>
      </section>
    </div>
  );
}

function CoverHero({
  trip,
  publicUrl,
  services,
  suppliers,
  payments,
  activityOptions,
  variantTrips,
}: {
  trip: Trip;
  publicUrl: string;
  services: TripService[];
  suppliers: Supplier[];
  payments: TripPayment[];
  activityOptions: { id: string; label: string }[];
  variantTrips: { id: string; title: string; is_published: boolean }[];
}) {
  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString("it-IT")} – ${new Date(trip.end_date).toLocaleDateString("it-IT")}`
      : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white shadow-sm">
      <div className="relative flex h-64 flex-col justify-between bg-[#233c5e] p-6">
        {trip.cover_image_url && (
          <>
            <Image src={trip.cover_image_url} alt="" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </>
        )}

        <div className="relative flex items-start justify-between gap-2">
          <span
            className={
              trip.is_published
                ? "rounded-full bg-green-500/90 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
            }
          >
            {trip.is_published ? "Pubblicato" : "Bozza"}
          </span>
          <span
            className={
              trip.itinerary_stage === "finale"
                ? "rounded-full bg-blue-500/90 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full bg-amber-500/90 px-3 py-1 text-xs font-semibold text-white"
            }
          >
            Itinerario {trip.itinerary_stage === "finale" ? "finale" : "preliminare"}
          </span>
        </div>

        <div className="relative text-white">
          <TripTitleEditor tripId={trip.id} title={trip.title} />
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/90">
            {trip.destination && (
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {trip.destination}
              </span>
            )}
            {dateRange && (
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {dateRange}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
        <form action={togglePublish.bind(null, trip.id, trip.is_published)}>
          <button
            type="submit"
            className={
              trip.is_published
                ? "flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                : "flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-green-200 transition hover:bg-green-700"
            }
          >
            <Rocket size={15} />
            {trip.is_published ? "Metti in bozza" : "Pubblica"}
          </button>
        </form>

        <Link
          href={`/trips/${trip.id}/preview`}
          target="_blank"
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Eye size={15} />
          Preview
        </Link>

        <form action={updateItineraryStage.bind(null, trip.id, trip.itinerary_stage)}>
          <button
            type="submit"
            title="Il cliente vede l'etichetta corrispondente in cima all'itinerario"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FileCheck2 size={15} />
            {trip.itinerary_stage === "finale" ? "Segna come preliminare" : "Segna come finale"}
          </button>
        </form>

        <form action={duplicateTripAsVariant.bind(null, trip.id)}>
          <SubmitButton
            pendingLabel="Creazione variante…"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Copy size={15} />
            Crea variante
          </SubmitButton>
        </form>

        <TripServicesPanel
          tripId={trip.id}
          services={services}
          suppliers={suppliers}
          payments={payments}
          activityOptions={activityOptions}
        />

        {trip.is_published ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1.5 text-sm font-medium text-[#233c5e] hover:underline"
          >
            {publicUrl}
            <ExternalLink size={13} />
          </a>
        ) : (
          <span className="ml-auto text-sm text-slate-400">
            Pubblica per ottenere un link da condividere col cliente.
          </span>
        )}
      </div>

      {variantTrips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Varianti di questo viaggio:</span>
          {variantTrips.map((variant) => (
            <Link
              key={variant.id}
              href={`/dashboard/trips/${variant.id}`}
              className="flex items-center gap-1.5 rounded-full border border-[#e6d7bb] bg-white px-3 py-1 text-sm font-medium text-[#233c5e] transition hover:bg-[#faf3e6]"
            >
              {variant.title}
              {!variant.is_published && <span className="text-xs text-slate-400">(bozza)</span>}
            </Link>
          ))}
        </div>
      )}

      <form action={uploadCover.bind(null, trip.id)} encType="multipart/form-data" className="p-4">
        <DropzoneUpload name="cover" accept="image/*" label="Trascina qui l'immagine di copertina" />
      </form>
    </section>
  );
}

function TripInfoForm({ trip }: { trip: Trip }) {
  const needsAttention = !trip.destination || !trip.start_date;

  return (
    <ExpandableSection
      title="Informazioni viaggio"
      badge={
        needsAttention && (
          <span className="rounded-full bg-[#f2e2c4] px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#8c7a5e]">
            da completare
          </span>
        )
      }
    >
      <form action={updateTripInfo.bind(null, trip.id)} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className={labelClass}>
            Titolo
          </label>
          <input id="title" name="title" defaultValue={trip.title} required className={inputClass} />
        </div>
        <div>
          <label htmlFor="destination" className={labelClass}>
            Destinazione
          </label>
          <input id="destination" name="destination" defaultValue={trip.destination ?? ""} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_date" className={labelClass}>
              Data inizio
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={trip.start_date ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="end_date" className={labelClass}>
              Data fine
            </label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={trip.end_date ?? ""}
              className={inputClass}
            />
          </div>
        </div>
        <TripPriceFields trip={trip} />
        <TitleColorField defaultValue={trip.title_color} />
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Salva informazioni
          </button>
        </div>
      </form>

      <details className="mt-6 border-t border-slate-100 pt-5">
        <summary className={`${labelClass} cursor-pointer select-none`}>Personalizza interfaccia viaggio</summary>
        <p className="mb-3 mt-2 text-xs text-slate-500">
          Scegli lo stile grafico della pagina che vedrà il cliente (font, colori, sfondi). Puoi cambiarlo quando vuoi.
        </p>
        <ThemePicker tripId={trip.id} current={trip.theme} />
      </details>
    </ExpandableSection>
  );
}
