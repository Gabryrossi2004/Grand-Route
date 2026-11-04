import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type {
  Activity,
  ActivityPhoto,
  ActivityTemplate,
  Trip,
  TripChecklistItem,
  TripDay,
  TripDocument,
} from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  Rocket,
} from "lucide-react";
import DropzoneUpload from "@/components/DropzoneUpload";
import ItineraryEditor from "@/components/ItineraryEditor";
import LibraryPanel from "@/components/LibraryPanel";
import TripPriceFields from "@/components/TripPriceFields";
import ThemePicker from "@/components/ThemePicker";
import TitleColorField from "@/components/TitleColorField";
import TripChecklist from "@/components/TripChecklist";
import {
  deleteDocument,
  duplicateTripAsVariant,
  togglePublish,
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

  const [{ data: days }, { data: templates }, { data: checklistItems }] = await Promise.all([
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
  ]);

  const orderedDays = ((days as DayWithActivities[]) || []).map((day) => ({
    ...day,
    activities: (day.activities || []).sort((a, b) => a.activity_order - b.activity_order),
  }));

  const host = (await headers()).get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const publicUrl = `${protocol}://${host}/t/${trip.public_slug}`;

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("trip_id", id)
    .order("uploaded_at", { ascending: false });

  const allDocumentsWithUrl = await Promise.all(
    ((documents as TripDocument[]) || []).map(async (document) => {
      const { data } = await supabase.storage
        .from("trip-documents")
        .createSignedUrl(document.file_path, 60 * 10);
      return { ...document, signedUrl: data?.signedUrl ?? null };
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
      <CoverHero trip={trip} publicUrl={publicUrl} />
      <TripInfoForm trip={trip} />
      <TripChecklist tripId={id} items={(checklistItems as TripChecklistItem[]) || []} />

      <section className="overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white shadow-md shadow-[#e6d7bb]/30">
        <div className="bg-gradient-to-r from-[#2b333e] via-[#333d4a] to-[#1e242d] px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Itinerario</h2>
          <p className="text-xs text-[#cbd1d8]">Il cuore del viaggio: giorni, attività e dettagli per il cliente.</p>
        </div>
        <div className="flex items-start gap-3 bg-gradient-to-b from-white to-[#fbf7ec] p-5">
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
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
          {documentsWithUrl.length === 0 ? (
            <p className="mb-4 text-sm text-slate-400">Nessun documento caricato ancora.</p>
          ) : (
            <ul className="mb-4 flex flex-col gap-2">
              {documentsWithUrl.map((document) => (
                <li
                  key={document.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText size={15} className="shrink-0 text-slate-400" />
                    {document.signedUrl ? (
                      <a
                        href={document.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm font-medium text-[#2b333e] hover:underline"
                      >
                        {document.file_name}
                      </a>
                    ) : (
                      <span className="truncate text-sm text-slate-700">{document.file_name}</span>
                    )}
                  </span>
                  <form action={deleteDocument.bind(null, id, document.id, document.file_path)}>
                    <button type="submit" className="shrink-0 text-xs text-red-500 hover:underline">
                      Elimina
                    </button>
                  </form>
                </li>
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

function CoverHero({ trip, publicUrl }: { trip: Trip; publicUrl: string }) {
  const dateRange =
    trip.start_date && trip.end_date
      ? `${new Date(trip.start_date).toLocaleDateString("it-IT")} – ${new Date(trip.end_date).toLocaleDateString("it-IT")}`
      : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative flex h-64 flex-col justify-between bg-slate-800 p-6">
        {trip.cover_image_url && (
          <Image src={trip.cover_image_url} alt="" fill priority sizes="100vw" className="object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />

        <div className="relative flex items-start justify-between">
          <span
            className={
              trip.is_published
                ? "rounded-full bg-green-500/90 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
            }
          >
            {trip.is_published ? "Pubblicato" : "Bozza"}
          </span>
        </div>

        <div className="relative text-white">
          <h1 className="text-3xl font-bold leading-tight drop-shadow-sm">{trip.title}</h1>
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
          href={`/trips/${trip.id}/overview`}
          target="_blank"
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <FileText size={15} />
          Overview
        </Link>

        <form action={duplicateTripAsVariant.bind(null, trip.id)}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Copy size={15} />
            Crea variante
          </button>
        </form>

        {trip.is_published ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1.5 text-sm font-medium text-[#2b333e] hover:underline"
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

      <form action={uploadCover.bind(null, trip.id)} encType="multipart/form-data" className="p-4">
        <DropzoneUpload name="cover" accept="image/*" label="Trascina qui l'immagine di copertina" />
      </form>
    </section>
  );
}

function TripInfoForm({ trip }: { trip: Trip }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-[#faf7ee] p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Informazioni viaggio</h2>
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
    </section>
  );
}
