"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
import {
  AlertTriangle,
  ArrowUpDown,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Activity, ActivityPhoto, ActivityTemplate, TripDay, TripDocument } from "@/lib/types";
import { activityTypes, detailFieldLabel, visibleDetailEntries } from "@/lib/activityTypes";
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
  deleteDocument,
  duplicateActivity,
  moveActivity,
  moveActivityToDay,
  reorderActivities,
  saveActivityToLibrary,
  sortActivitiesByTime,
  swapDayContent,
  updateActivity,
  updateDayTitle,
  uploadActivityPhoto,
  uploadDocument,
} from "@/app/dashboard/trips/[id]/actions";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };
type ActivityDocument = TripDocument & { signedUrl: string | null };

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
  documentsByActivity,
}: {
  tripId: string;
  days: DayWithActivities[];
  templates: ActivityTemplate[];
  documentsByActivity: Record<string, ActivityDocument[]>;
}) {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(days[0]?.id ?? null);
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0] ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const [draggedDayId, setDraggedDayId] = useState<string | null>(null);
  const [dragOverDayId, setDragOverDayId] = useState<string | null>(null);
  const [draggedActivity, setDraggedActivity] = useState<{ id: string; sourceDayId: string } | null>(null);

  function handleDropDay(targetDayId: string) {
    if (draggedActivity) {
      if (draggedActivity.sourceDayId !== targetDayId) {
        moveActivityToDay(tripId, draggedActivity.id, targetDayId);
      }
      setDraggedActivity(null);
      setDragOverDayId(null);
      return;
    }
    if (draggedDayId && draggedDayId !== targetDayId) {
      swapDayContent(tripId, draggedDayId, targetDayId);
    }
    setDraggedDayId(null);
    setDragOverDayId(null);
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <aside className="flex shrink-0 flex-col gap-2 sm:sticky sm:top-20 sm:max-h-[calc(100vh-6rem)] sm:w-56 sm:self-start sm:overflow-y-auto">
        <form action={addDay.bind(null, tripId)} className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-3">
          <label htmlFor="day_date" className="text-xs font-medium text-slate-600">
            Aggiungi un giorno
          </label>
          <input
            id="day_date"
            name="day_date"
            type="date"
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#cda876]"
          />
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            + Aggiungi
          </button>
        </form>

        {days.map((day, index) => (
          <DaySidebarItem
            key={day.id}
            day={day}
            index={index}
            tripId={tripId}
            isActive={day.id === selectedDay?.id}
            isToday={day.day_date === todayStr}
            isDragOver={dragOverDayId === day.id}
            onSelect={() => setSelectedDayId(day.id)}
            onDragStart={() => setDraggedDayId(day.id)}
            onDragEnter={() => {
              if (draggedActivity) {
                if (draggedActivity.sourceDayId !== day.id) setDragOverDayId(day.id);
                return;
              }
              if (draggedDayId && draggedDayId !== day.id) setDragOverDayId(day.id);
            }}
            onDragEnd={() => {
              setDraggedDayId(null);
              setDraggedActivity(null);
              setDragOverDayId(null);
            }}
            onDrop={() => handleDropDay(day.id)}
          />
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        {selectedDay ? (
          <DayPanel
            key={selectedDay.id}
            day={selectedDay}
            tripId={tripId}
            templates={templates}
            documentsByActivity={documentsByActivity}
            onActivityDragStart={(activityId) => setDraggedActivity({ id: activityId, sourceDayId: selectedDay.id })}
            onActivityDragEnd={() => setDraggedActivity(null)}
          />
        ) : (
          <p className="text-sm text-slate-400">Aggiungi il primo giorno per iniziare l&apos;itinerario.</p>
        )}
      </div>
    </div>
  );
}

function DaySidebarItem({
  day,
  index,
  tripId,
  isActive,
  isToday,
  isDragOver,
  onSelect,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
}: {
  day: DayWithActivities;
  index: number;
  tripId: string;
  isActive: boolean;
  isToday: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(day.title ?? "");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus();
  }, [isEditingTitle]);

  function saveTitle() {
    setIsEditingTitle(false);
    if (titleInput.trim() !== (day.title ?? "")) {
      updateDayTitle(tripId, day.id, titleInput);
    }
  }

  const types = Array.from(new Set(day.activities.map((a) => a.activity_type)));

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      onDoubleClick={() => setIsEditingTitle(true)}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      title="Trascina per scambiare il contenuto con un altro giorno"
      className={`cursor-grab rounded-lg border px-3 py-2 text-left transition active:cursor-grabbing ${
        isDragOver
          ? "border-[#cda876] bg-[#f2e2c4] ring-2 ring-[#ddc8a0]"
          : isActive
            ? "border-[#d3b589] bg-[#faf3e6]"
            : "border-[#e6d7bb] bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs uppercase text-slate-400">
          <GripVertical size={12} className="text-slate-300" />
          Giorno {index + 1}
        </p>
        {isToday && (
          <span className="rounded-full bg-[#2b333e] px-2 py-0.5 text-[10px] font-semibold text-white">
            Oggi
          </span>
        )}
      </div>
      <p className="text-sm font-medium capitalize text-slate-900">{dayLabel(day, index, true)}</p>
      {isEditingTitle ? (
        <input
          ref={titleInputRef}
          type="text"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveTitle();
            }
            if (e.key === "Escape") {
              setTitleInput(day.title ?? "");
              setIsEditingTitle(false);
            }
          }}
          placeholder="Titolo del giorno (es. Benvenuti!)"
          className="mt-1 w-full rounded border border-[#ddc8a0] px-1.5 py-0.5 text-xs outline-none"
        />
      ) : (
        day.title && <p className="mt-0.5 truncate text-xs italic text-slate-500">{day.title}</p>
      )}
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
    </div>
  );
}

function DayPanel({
  day,
  tripId,
  templates,
  documentsByActivity,
  onActivityDragStart,
  onActivityDragEnd,
}: {
  day: DayWithActivities;
  tripId: string;
  templates: ActivityTemplate[];
  documentsByActivity: Record<string, ActivityDocument[]>;
  onActivityDragStart: (activityId: string) => void;
  onActivityDragEnd: () => void;
}) {
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const deleteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const deleteRemovedAt = useRef<Map<string, number>>(new Map());

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

  // Orari duplicati nello stesso giorno (non sappiamo le durate, ma almeno
  // segnaliamo quando due attività iniziano esattamente alla stessa ora).
  const startTimeCounts = new Map<string, number>();
  for (const activity of orderedActivities) {
    if (!activity.start_time) continue;
    const key = activity.start_time.slice(0, 5);
    startTimeCounts.set(key, (startTimeCounts.get(key) ?? 0) + 1);
  }

  function requestDeleteActivity(activityId: string) {
    const index = orderIds.indexOf(activityId);
    if (index === -1) return;
    deleteRemovedAt.current.set(activityId, index);
    setOrderIds((prev) => prev.filter((id) => id !== activityId));
    setPendingDeleteIds((prev) => new Set(prev).add(activityId));

    const timer = setTimeout(() => {
      deleteTimers.current.delete(activityId);
      deleteRemovedAt.current.delete(activityId);
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
      deleteActivity(tripId, activityId);
    }, 5000);
    deleteTimers.current.set(activityId, timer);
  }

  function undoDeleteActivity(activityId: string) {
    const timer = deleteTimers.current.get(activityId);
    if (timer) clearTimeout(timer);
    deleteTimers.current.delete(activityId);

    const index = deleteRemovedAt.current.get(activityId) ?? 0;
    deleteRemovedAt.current.delete(activityId);
    setOrderIds((prev) => {
      const next = [...prev];
      next.splice(index, 0, activityId);
      return next;
    });
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      next.delete(activityId);
      return next;
    });
  }

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
    <div className="rounded-xl border border-[#e6d7bb] bg-white p-5">
      <div className="sticky top-4 z-10 mb-3 flex items-center justify-between gap-2 rounded-lg bg-white/95 py-1 backdrop-blur">
        <h3 className="font-medium capitalize text-slate-900">
          {dayLabel(day, 0, true)}
          {day.title && <span className="font-normal text-slate-500"> — {day.title}</span>}
        </h3>
        <div className="flex items-center gap-3">
          {sortedActivities.length > 1 && (
            <form action={sortActivitiesByTime.bind(null, tripId, day.id)}>
              <button type="submit" className="flex items-center gap-1 text-xs text-slate-500 hover:underline">
                <ArrowUpDown size={12} /> Ordina per orario
              </button>
            </form>
          )}
          <form action={deleteDay.bind(null, tripId, day.id)}>
            <button type="submit" className="flex items-center gap-1 text-xs text-red-500 hover:underline">
              <Trash2 size={12} /> Elimina giorno
            </button>
          </form>
          <button
            type="button"
            onClick={() => setIsAddingActivity(true)}
            className="flex items-center gap-1 rounded-md bg-[#2b333e] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1e242d]"
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
                dayDate={day.day_date}
                templates={templates}
                documents={documentsByActivity[activity.id] ?? []}
                hasTimeClash={Boolean(activity.start_time && (startTimeCounts.get(activity.start_time.slice(0, 5)) ?? 0) > 1)}
                isEditing={editingActivityId === activity.id}
                isExpanded={!collapsedIds.has(activity.id)}
                onToggleExpand={() => toggleCollapsed(activity.id)}
                onEdit={() => setEditingActivityId(activity.id)}
                onCancelEdit={() => setEditingActivityId(null)}
                onDelete={() => requestDeleteActivity(activity.id)}
                onDragStart={() => onActivityDragStart(activity.id)}
                onDragEnd={onActivityDragEnd}
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
            dayDate={day.day_date}
          />
        </Modal>
      )}

      {pendingDeleteIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
          {Array.from(pendingDeleteIds).map((id) => (
            <div
              key={id}
              className="flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
            >
              <span>
                &quot;{activityById.get(id)?.title ?? "Attività"}&quot; eliminata
              </span>
              <button
                type="button"
                onClick={() => undoDeleteActivity(id)}
                className="font-semibold text-[#ddc8a0] hover:text-[#e6d7bb]"
              >
                Annulla
              </button>
            </div>
          ))}
        </div>
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
  dayDate,
  templates,
  documents,
  hasTimeClash,
  isEditing,
  isExpanded,
  onToggleExpand,
  onEdit,
  onCancelEdit,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  activity: ActivityWithPhotos;
  index: number;
  total: number;
  tripId: string;
  dayId: string;
  dayDate: string | null;
  templates: ActivityTemplate[];
  documents: ActivityDocument[];
  hasTimeClash: boolean;
  isEditing: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
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

  const editModal = isEditing && (
    <Modal title={`Modifica: ${activity.title}`} onClose={onCancelEdit} wide>
      <ActivityForm
        action={updateActivity.bind(null, tripId, activity.id)}
        templates={templates}
        initialActivity={activity}
        onCancel={onCancelEdit}
        tripId={tripId}
        photos={activity.activity_photos}
        dayDate={dayDate}
      />
    </Modal>
  );

  const meta = activityTypes[activity.activity_type];
  const Icon = meta.icon;
  const detailEntries = visibleDetailEntries(activity.details);

  return (
    <>
      {editModal}
      <li
        ref={setNodeRef}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDoubleClick={onEdit}
        title="Trascina per spostare in un altro giorno · doppio click per modificare"
        style={{ ...style, borderLeftColor: meta.color, backgroundColor: meta.bg }}
        className="group rounded-md border-l-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
      >
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          draggable={false}
          {...attributes}
          {...listeners}
          aria-label="Trascina per riordinare"
          className="shrink-0 cursor-grab touch-none p-1 text-slate-300 opacity-0 transition-opacity hover:text-slate-500 focus:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full min-w-0 items-center gap-2 py-2 text-left"
        >
          <span
            style={{ backgroundColor: meta.color }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          >
            <Icon size={17} />
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">
            {activity.start_time && <span className="mr-2 text-slate-500">{activity.start_time.slice(0, 5)}</span>}
            {activity.title}
            {hasTimeClash && (
              <span title="Stesso orario di un'altra attività" className="ml-1.5 inline-block align-middle">
                <AlertTriangle size={13} className="text-amber-500" />
              </span>
            )}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pl-12">
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
                      <dt className="font-medium">{detailFieldLabel(activity.activity_type, key)}:</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <form action={saveActivityToLibrary.bind(null, tripId, activity.id)}>
                  <button
                    type="submit"
                    title="Salva in libreria"
                    className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90"
                  >
                    <BookmarkPlus size={18} />
                  </button>
                </form>
                <form action={duplicateActivity.bind(null, tripId, dayId, activity.id)}>
                  <button
                    type="submit"
                    title="Duplica attività"
                    className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90"
                  >
                    <Copy size={18} />
                  </button>
                </form>
                <button
                  type="button"
                  onClick={onEdit}
                  title="Modifica"
                  className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90"
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  title="Elimina"
                  className="rounded-md p-2 text-red-500 transition hover:bg-red-50 active:scale-90"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="flex gap-1">
                <form action={moveActivity.bind(null, tripId, dayId, activity.id, "up")}>
                  <button
                    type="submit"
                    disabled={index === 0}
                    title="Sposta su"
                    className="rounded-md border border-slate-300 p-1.5 text-slate-500 transition hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:active:scale-100"
                  >
                    <ChevronUp size={16} />
                  </button>
                </form>
                <form action={moveActivity.bind(null, tripId, dayId, activity.id, "down")}>
                  <button
                    type="submit"
                    disabled={index === total - 1}
                    title="Sposta giù"
                    className="rounded-md border border-slate-300 p-1.5 text-slate-500 transition hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:active:scale-100"
                  >
                    <ChevronDown size={16} />
                  </button>
                </form>
              </div>
            </div>
          </div>

          {activity.activity_photos && activity.activity_photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {activity.activity_photos.map((photo) => (
                <div key={photo.id} className="group relative h-24 w-24">
                  <div className="relative h-full w-full overflow-hidden rounded-md">
                    <Image src={photo.url} alt="" fill sizes="6rem" className="object-cover" />
                  </div>
                  <form action={deleteActivityPhoto.bind(null, tripId, photo.id, photo.file_path)}>
                    <button
                      type="submit"
                      className="absolute -right-1.5 -top-1.5 hidden h-6 w-6 rounded-full bg-red-600 text-sm text-white group-hover:block"
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

          {documents.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {documents.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-700">
                    <FileText size={13} className="shrink-0 text-slate-400" />
                    {document.signedUrl ? (
                      <a
                        href={document.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-medium text-[#2b333e] hover:underline"
                      >
                        {document.file_name}
                      </a>
                    ) : (
                      <span className="truncate">{document.file_name}</span>
                    )}
                  </span>
                  <form action={deleteDocument.bind(null, tripId, document.id, document.file_path)}>
                    <button
                      type="submit"
                      title="Elimina documento"
                      className="shrink-0 rounded-md p-1.5 text-red-500 transition hover:bg-red-50 active:scale-90"
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
              + Aggiungi documento (voucher, biglietto…)
            </summary>
            <form
              action={uploadDocument.bind(null, tripId, activity.id)}
              encType="multipart/form-data"
              className="mt-2 max-w-xs"
            >
              <DropzoneUpload name="file" label="Trascina un documento qui" />
            </form>
          </details>
        </div>
      )}
      </li>
    </>
  );
}
