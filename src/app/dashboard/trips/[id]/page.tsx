import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Activity, Trip, TripDay, TripDocument } from "@/lib/types";
import {
  addActivity,
  addDay,
  deleteActivity,
  deleteDay,
  deleteDocument,
  togglePublish,
  updateTripInfo,
  uploadDocument,
} from "./actions";

type DayWithActivities = TripDay & { activities: Activity[] };

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) notFound();

  const { data: days } = await supabase
    .from("trip_days")
    .select("*, activities(*)")
    .eq("trip_id", id)
    .order("day_order", { ascending: true });

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
      <TripHeader trip={trip} publicUrl={publicUrl} />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Itinerario</h2>
        <div className="flex flex-col gap-6">
          {orderedDays.map((day, index) => (
            <DayCard key={day.id} day={day} tripId={id} dayNumber={index + 1} />
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
            className="flex items-center gap-3 border-t border-slate-100 pt-4"
          >
            <input
              type="file"
              name="file"
              required
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
            />
            <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Carica
            </button>
          </form>
        </div>
      </section>
    </div>
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
      </div>
    </section>
  );
}

function DayCard({
  day,
  tripId,
  dayNumber,
}: {
  day: DayWithActivities;
  tripId: string;
  dayNumber: number;
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

      <ul className="mb-4 flex flex-col gap-2">
        {day.activities.map((activity) => (
          <li key={activity.id} className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {activity.start_time && <span className="mr-2 text-slate-500">{activity.start_time.slice(0, 5)}</span>}
                {activity.title}
              </p>
              {activity.location && <p className="text-xs text-slate-500">{activity.location}</p>}
              {activity.description && <p className="mt-1 text-sm text-slate-600">{activity.description}</p>}
            </div>
            <form action={deleteActivity.bind(null, tripId, activity.id)}>
              <button type="submit" className="text-xs text-red-500 hover:underline">
                Elimina
              </button>
            </form>
          </li>
        ))}
        {day.activities.length === 0 && <p className="text-sm text-slate-400">Nessuna attività ancora.</p>}
      </ul>

      <form action={addActivity.bind(null, tripId, day.id)} className="grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[100px_1fr_1fr]">
        <input
          name="start_time"
          type="time"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <input
          name="title"
          type="text"
          placeholder="Attività (es. Check-in hotel)"
          required
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <input
          name="location"
          type="text"
          placeholder="Luogo (opzionale)"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <input
          name="description"
          type="text"
          placeholder="Note (opzionale)"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 sm:col-span-2"
        />
        <button type="submit" className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          + Aggiungi attività
        </button>
      </form>
    </div>
  );
}
