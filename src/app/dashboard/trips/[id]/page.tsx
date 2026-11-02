import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, ActivityTemplate, Trip, TripDay, TripDocument } from "@/lib/types";
import Link from "next/link";
import DropzoneUpload from "@/components/DropzoneUpload";
import ItineraryEditor from "@/components/ItineraryEditor";
import TripPriceFields from "@/components/TripPriceFields";
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

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) notFound();

  const [{ data: days }, { data: templates }] = await Promise.all([
    supabase
      .from("trip_days")
      .select("*, activities(*, activity_photos(*))")
      .eq("trip_id", id)
      .order("day_order", { ascending: true }),
    supabase.from("activity_templates").select("*").order("title", { ascending: true }),
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

  const documentsWithUrl = await Promise.all(
    ((documents as TripDocument[]) || []).map(async (document) => {
      const { data } = await supabase.storage
        .from("trip-documents")
        .createSignedUrl(document.file_path, 60 * 10);
      return { ...document, signedUrl: data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <CoverHero trip={trip} />
      <TripHeader trip={trip} publicUrl={publicUrl} />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Itinerario</h2>
        <ItineraryEditor tripId={id} days={orderedDays} templates={(templates as ActivityTemplate[]) || []} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Documenti</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {documentsWithUrl.length === 0 ? (
            <p className="mb-4 text-sm text-slate-400">Nessun documento caricato (biglietti, voucher, ecc.).</p>
          ) : (
            <ul className="mb-4 flex flex-col gap-2">
              {documentsWithUrl.map((document) => (
                <li key={document.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  {document.signedUrl ? (
                    <a
                      href={document.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {document.file_name}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-700">{document.file_name}</span>
                  )}
                  <form action={deleteDocument.bind(null, id, document.id, document.file_path)}>
                    <button type="submit" className="text-xs text-red-500 hover:underline">
                      Elimina
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form
            action={uploadDocument.bind(null, id)}
            encType="multipart/form-data"
            className="border-t border-slate-100 pt-4"
          >
            <DropzoneUpload name="file" label="Carica un biglietto o voucher" />
          </form>
        </div>
      </section>
    </div>
  );
}

function CoverHero({ trip }: { trip: Trip }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        className="relative flex h-48 items-end bg-slate-800 bg-cover bg-center p-6"
        style={trip.cover_image_url ? { backgroundImage: `url(${trip.cover_image_url})` } : undefined}
      >
        <div className="absolute inset-0 bg-black/40" />
        <h1 className="relative text-2xl font-semibold text-white">{trip.title}</h1>
      </div>
      <form action={uploadCover.bind(null, trip.id)} encType="multipart/form-data" className="p-4">
        <DropzoneUpload name="cover" accept="image/*" label="Trascina qui l'immagine di copertina" />
      </form>
    </section>
  );
}

function TripHeader({ trip, publicUrl }: { trip: Trip; publicUrl: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <form action={updateTripInfo.bind(null, trip.id)} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
            Titolo
          </label>
          <input
            id="title"
            name="title"
            defaultValue={trip.title}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="destination" className="mb-1 block text-sm font-medium text-slate-700">
            Destinazione
          </label>
          <input
            id="destination"
            name="destination"
            defaultValue={trip.destination ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_date" className="mb-1 block text-sm font-medium text-slate-700">
              Data inizio
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={trip.start_date ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="end_date" className="mb-1 block text-sm font-medium text-slate-700">
              Data fine
            </label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={trip.end_date ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <TripPriceFields trip={trip} />
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Salva informazioni
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <form action={togglePublish.bind(null, trip.id, trip.is_published)}>
          <button
            type="submit"
            className={
              trip.is_published
                ? "rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                : "rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            }
          >
            {trip.is_published ? "Metti in bozza" : "Pubblica"}
          </button>
        </form>

        <Link
          href={`/dashboard/trips/${trip.id}/overview`}
          target="_blank"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Overview
        </Link>

        {trip.is_published && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {publicUrl}
          </a>
        )}
        {!trip.is_published && (
          <span className="text-sm text-slate-400">
            Pubblica il viaggio per ottenere un link da condividere col cliente.
          </span>
        )}

        <form action={duplicateTripAsVariant.bind(null, trip.id)} className="ml-auto">
          <button type="submit" className="text-sm font-medium text-slate-500 hover:text-slate-900 hover:underline">
            Crea una variante di questo viaggio
          </button>
        </form>
      </div>
    </section>
  );
}

