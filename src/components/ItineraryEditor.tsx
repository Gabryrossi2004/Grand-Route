"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Plus } from "lucide-react";
import type { Activity, ActivityPhoto, ActivityTemplate, TripDay } from "@/lib/types";
import { activityTypes, detailFieldLabels } from "@/lib/activityTypes";
import { richTextClassName, toSafeHtml } from "@/lib/richText";
import { sanitizeHtml } from "@/lib/sanitize";
import DropzoneUpload from "@/components/DropzoneUpload";
import ActivityForm from "@/components/ActivityForm";
import Modal from "@/components/Modal";
import {
  addActivity,
  addDay,
  deleteActivity,
  deleteActivityPhoto,
  deleteDay,
  moveActivity,
  reorderActivities,
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
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isAddingActivity, setIsAddingActivity] = useState(false);

  const sortedActivities = [...day.activities].sort((a, b) => a.activity_order - b.activity_order);
  const serverOrderKey = sortedActivities.map((a) => a.id).join(",");
  const [orderIds, setOrderIds] = useState<string[]>(sortedActivities.map((a) => a.id));
  const lastServerOrderKey = useRef(serverOrderKey);

  useEffect(() => {
    if (lastServerOrderKey.current !== serverOrderKey) {
      setOrderIds(sortedActivities.map((a) => a.id));
      lastServerOrderKey.current = serverOrderKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverOrderKey]);

  const activityById = new Map(sortedActivities.map((activity) => [activity.id, activity]));
  const orderedActivities = orderIds
    .map((id) => activityById.get(id))
    .filter((activity): activity is ActivityWithPhotos => Boolean(activity));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function toggleCollapsed(activityId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderIds.indexOf(String(active.id));
    const newIndex = orderIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(orderIds, oldIndex, newIndex);
    setOrderIds(newOrder);
    lastServerOrderKey.current = newOrder.join(",");
    reorderActivities(tripId, newOrder);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="sticky top-4 z-10 mb-3 flex items-center justify-between gap-2 rounded-lg bg-white/95 py-1 backdrop-blur">
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
          <button
            type="button"
            onClick={() => setIsAddingActivity(true)}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={15} /> Attività
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderIds} strategy={verticalListSortingStrategy}>
          <ul className="mb-2 flex flex-col gap-3">
            {orderedActivities.map((activity, index) => (
              <SortableActivityRow
                key={activity.id}
                activity={activity}
                index={index}
                total={orderedActivities.length}
                tripId={tripId}
                dayId={day.id}
                templates={templates}
                isEditing={editingActivityId === activity.id}
                isExpanded={!collapsedIds.has(activity.id)}
                onToggleExpand={() => toggleCollapsed(activity.id)}
                onEdit={() => setEditingActivityId(activity.id)}
                onCancelEdit={() => setEditingActivityId(null)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {orderedActivities.length === 0 && <p className="mb-2 text-sm text-slate-400">Nessuna attività ancora.</p>}

      {isAddingActivity && (
        <Modal title="Nuova attività" onClose={() => setIsAddingActivity(false)}>
          <ActivityForm
            action={addActivity.bind(null, tripId, day.id)}
            templates={templates}
            onSubmitted={() => setIsAddingActivity(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function SortableActivityRow({
  activity,
  index,
  total,
  tripId,
  dayId,
  templates,
  isEditing,
  isExpanded,
  onToggleExpand,
  onEdit,
  onCancelEdit,
}: {
  activity: ActivityWithPhotos;
  index: number;
  total: number;
  tripId: string;
  dayId: string;
  templates: ActivityTemplate[];
  isEditing: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
    disabled: isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing) {
    return (
      <li ref={setNodeRef} style={style} className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
        <ActivityForm
          action={updateActivity.bind(null, tripId, activity.id)}
          templates={templates}
          initialActivity={activity}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }

  const meta = activityTypes[activity.activity_type];
  const Icon = meta.icon;
  const detailEntries = Object.entries(activity.details || {});

  return (
    <li
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: meta.color, backgroundColor: meta.bg }}
      className="rounded-md border-l-4"
    >
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Trascina per riordinare"
          className="shrink-0 cursor-grab touch-none p-1 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <button type="button" onClick={onToggleExpand} className="flex w-full min-w-0 items-center gap-2 py-2 text-left">
          <span
            style={{ backgroundColor: meta.color }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
          >
            <Icon size={14} />
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">
            {activity.start_time && <span className="mr-2 text-slate-500">{activity.start_time.slice(0, 5)}</span>}
            {activity.title}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pl-11">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                style={{ color: meta.color, borderColor: meta.color }}
                className="mb-1 inline-block rounded-full border px-2 py-0.5 text-xs font-medium"
              >
                {meta.label}
              </span>
              {activity.location && <p className="text-xs text-slate-500">{activity.location}</p>}
              {activity.description && (
                <div
                  className={richTextClassName + " mt-1"}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(toSafeHtml(activity.description)) }}
                />
              )}
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
                <button type="button" onClick={onEdit} className="text-xs text-slate-500 hover:underline">
                  Modifica
                </button>
                <form action={deleteActivity.bind(null, tripId, activity.id)}>
                  <button type="submit" className="text-xs text-red-500 hover:underline">
                    Elimina
                  </button>
                </form>
              </div>
              <div className="flex gap-1">
                <form action={moveActivity.bind(null, tripId, dayId, activity.id, "up")}>
                  <button
                    type="submit"
                    disabled={index === 0}
                    className="rounded border border-slate-300 px-1.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ▲
                  </button>
                </form>
                <form action={moveActivity.bind(null, tripId, dayId, activity.id, "down")}>
                  <button
                    type="submit"
                    disabled={index === total - 1}
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
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">+ Aggiungi foto</summary>
            <form
              action={uploadActivityPhoto.bind(null, tripId, activity.id)}
              encType="multipart/form-data"
              className="mt-2 max-w-xs"
            >
              <DropzoneUpload name="photo" accept="image/*" label="Trascina una foto qui" />
            </form>
          </details>
        </div>
      )}
    </li>
  );
}
