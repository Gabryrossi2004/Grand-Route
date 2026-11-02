"use client";

import { useState } from "react";
import type { Activity, ActivityPhoto, ActivityTemplate, TripDay } from "@/lib/types";
import { activityTypes, detailFieldLabels } from "@/lib/activityTypes";
import DropzoneUpload from "@/components/DropzoneUpload";
import ActivityForm from "@/components/ActivityForm";
import {
  addActivity,
  addDay,
  deleteActivity,
  deleteActivityPhoto,
  deleteDay,
  moveActivity,
  sortActivitiesByTime,
  updateActivity,
  uploadActivityPhoto,
} from "@/app/dashboard/trips/[id]/actions";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };

function dayLabel(day: DayWithActivities, index: number, long = false) {
  if (!day.day_date) return `Giorno ${index + 1}`;
  return new Date(day.day_date).toLocaleDateString("it-IT", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
  });
}

export default function ItineraryEditor({
  tripId,
  days,
  templates,
}: {
  tripId: string;
  days: DayWithActivities[];
  templates: ActivityTemplate[];
}) {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(days[0]?.id ?? null);
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0] ?? null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <aside className="flex shrink-0 flex-col gap-2 sm:w-56">
        {days.map((day, index) => {
          const types = Array.from(new Set(day.activities.map((a) => a.activity_type)));
          const isActive = day.id === selectedDay?.id;
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => setSelectedDayId(day.id)}
              className={`rounded-lg border px-3 py-2 text-left ${
                isActive ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <p className="text-xs uppercase text-slate-400">Giorno {index + 1}</p>
              <p className="text-sm font-medium capitalize text-slate-900">{dayLabel(day, index, true)}</p>
              {types.length > 0 && (
                <div className="mt-1 flex gap-1">
                  {types.map((type) => (
                    <span
                      key={type}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: activityTypes[type].color }}
                      title={activityTypes[type].label}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}

        <form action={addDay.bind(null, tripId)} className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-3">
          <label htmlFor="day_date" className="text-xs font-medium text-slate-600">
            Aggiungi un giorno
          </label>
          <input
            id="day_date"
            name="day_date"
            type="date"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
          />
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            + Aggiungi
          </button>
        </form>
      </aside>

      <div className="min-w-0 flex-1">
        {selectedDay ? (
          <DayPanel key={selectedDay.id} day={selectedDay} tripId={tripId} templates={templates} />
        ) : (
          <p className="text-sm text-slate-400">Aggiungi il primo giorno per iniziare l&apos;itinerario.</p>
        )}
      </div>
    </div>
  );
}

function DayPanel({
  day,
  tripId,
  templates,
}: {
  day: DayWithActivities;
  tripId: string;
  templates: ActivityTemplate[];
}) {
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const sortedActivities = [...day.activities].sort((a, b) => a.activity_order - b.activity_order);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-medium capitalize text-slate-900">{dayLabel(day, 0, true)}</h3>
        <div className="flex items-center gap-3">
          {sortedActivities.length > 1 && (
            <form action={sortActivitiesByTime.bind(null, tripId, day.id)}>
              <button type="submit" className="text-xs text-slate-500 hover:underline">
                Ordina per orario
              </button>
            </form>
          )}
          <form action={deleteDay.bind(null, tripId, day.id)}>
            <button type="submit" className="text-xs text-red-500 hover:underline">
              Elimina giorno
            </button>
          </form>
        </div>
      </div>

      <ul className="mb-4 flex flex-col gap-3">
        {sortedActivities.map((activity, index) => {
          if (editingActivityId === activity.id) {
            return (
              <li key={activity.id} className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
                <ActivityForm
                  action={updateActivity.bind(null, tripId, activity.id)}
                  templates={templates}
                  initialActivity={activity}
                  onCancel={() => setEditingActivityId(null)}
                />
              </li>
            );
          }

          const meta = activityTypes[activity.activity_type];
          const detailEntries = Object.entries(activity.details || {});

          return (
            <li
              key={activity.id}
              style={{ borderLeftColor: meta.color, backgroundColor: meta.bg }}
              className="rounded-md border-l-4 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingActivityId(activity.id)}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Modifica
                    </button>
                    <form action={deleteActivity.bind(null, tripId, activity.id)}>
                      <button type="submit" className="text-xs text-red-500 hover:underline">
                        Elimina
                      </button>
                    </form>
                  </div>
                  <div className="flex gap-1">
                    <form action={moveActivity.bind(null, tripId, day.id, activity.id, "up")}>
                      <button
                        type="submit"
                        disabled={index === 0}
                        className="rounded border border-slate-300 px-1.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      >
                        ▲
                      </button>
                    </form>
                    <form action={moveActivity.bind(null, tripId, day.id, activity.id, "down")}>
                      <button
                        type="submit"
                        disabled={index === sortedActivities.length - 1}
                        className="rounded border border-slate-300 px-1.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </form>
                  </div>
                </div>
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
        {sortedActivities.length === 0 && <p className="text-sm text-slate-400">Nessuna attività ancora.</p>}
      </ul>

      <ActivityForm action={addActivity.bind(null, tripId, day.id)} templates={templates} />
    </div>
  );
}
