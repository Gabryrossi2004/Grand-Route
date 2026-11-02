import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityPhoto, ActivityTemplate, Trip, TripDay, TripDocument } from "@/lib/types";
import { activityTypes, detailFieldLabels } from "@/lib/activityTypes";
import DropzoneUpload from "@/components/DropzoneUpload";
import ActivityForm from "@/components/ActivityForm";
import {
  addActivity,
  addDay,
  deleteActivity,
  deleteActivityPhoto,
  deleteDay,
  deleteDocument,
  duplicateTripAsVariant,
  togglePublish,
  updateTripInfo,
  uploadActivityPhoto,
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
        <div className="flex flex-col gap-6">
          {orderedDays.map((day, index) => (
            <DayCard
              key={day.id}
              day={day}
              tripId={id}
              dayNumber={index + 1}
              templates={(templates as ActivityTemplate[]) || []}
            />
          ))}
        </div>

        <form action={addDay.bind(null, id)} className="mt-6 flex items-end gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4">
          <div>
            <label htmlFor="day_date" className="mb-1 block text-sm font-medium text-slate-700">
              Aggiungi un giorno (data opzionale)
            </label>
            <input
              id="day_date"
              name="day_date"
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            + Aggiungi giorno
          </button>
        </form>
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

function DayCard({
  day,
  tripId,
  dayNumber,
  templates,
}: {
  day: DayWithActivities;
  tripId: string;
  dayNumber: number;
  templates: ActivityTemplate[];
}) {
  const dateLabel = day.day_date
    ? new Date(day.day_date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })
    : `Giorno ${dayNumber}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium capitalize text-slate-900">{dateLabel}</h3>
        <form action={deleteDay.bind(null, tripId, day.id)}>
          <button type="submit" className="text-xs text-red-500 hover:underline">
            Elimina giorno
          </button>
        </form>
      </div>

      <ul className="mb-4 flex flex-col gap-3">
        {day.activities.map((activity) => {
          const meta = activityTypes[activity.activity_type];
          const detailEntries = Object.entries(activity.details || {});
          return (
            <li
              key={activity.id}
              style={{ borderLeftColor: meta.color, backgroundColor: meta.bg }}
              className="rounded-md border-l-4 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {activity.start_time && (
                      <span className="mr-2 text-slate-500">{activity.start_time.slice(0, 5)}</span>
                    )}
                    {activity.title}
                    <span
                      style={{ color: meta.color, borderColor: meta.color }}
                      className="ml-2 rounded-full border px-2 py-0.5 text-xs font-medium"
                    >
                      {meta.label}
                    </span>
                  </p>
                  {activity.location && <p className="text-xs text-slate-500">{activity.location}</p>}
                  {activity.description && <p className="mt-1 text-sm text-slate-600">{activity.description}</p>}
                  {detailEntries.length > 0 && (
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      {detailEntries.map(([key, value]) => (
                        <div key={key} className="flex gap-1">
                          <dt className="font-medium">{detailFieldLabels[key] ?? key}:</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                <form action={deleteActivity.bind(null, tripId, activity.id)}>
                  <button type="submit" className="text-xs text-red-500 hover:underline">
                    Elimina
                  </button>
                </form>
              </div>

              {activity.activity_photos && activity.activity_photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activity.activity_photos.map((photo) => (
                    <div key={photo.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="h-16 w-16 rounded-md object-cover" />
                      <form action={deleteActivityPhoto.bind(null, tripId, photo.id, photo.file_path)}>
                        <button
                          type="submit"
                          className="absolute -right-1 -top-1 hidden h-5 w-5 rounded-full bg-red-600 text-xs text-white group-hover:block"
                        >
                          ×
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                  + Aggiungi foto
                </summary>
                <form
                  action={uploadActivityPhoto.bind(null, tripId, activity.id)}
                  encType="multipart/form-data"
                  className="mt-2 max-w-xs"
                >
                  <DropzoneUpload name="photo" accept="image/*" label="Trascina una foto qui" />
                </form>
              </details>
            </li>
          );
        })}
        {day.activities.length === 0 && <p className="text-sm text-slate-400">Nessuna attività ancora.</p>}
      </ul>

      <ActivityForm action={addActivity.bind(null, tripId, day.id)} templates={templates} />
    </div>
  );
}
