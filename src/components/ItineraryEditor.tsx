"use client";

import DocumentVisibilityToggle from "@/components/DocumentVisibilityToggle";
import { useEffect, useRef, useState, useTransition } from "react";
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
  BookmarkPlus,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
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
import UploadForm from "@/components/UploadForm";
import ActivityForm from "@/components/ActivityForm";
import MiniDatePicker from "@/components/MiniDatePicker";
import Modal from "@/components/Modal";
import {
  addActivity,
  addDay,
  deleteActivityPhoto,
  deleteDocument,
  duplicateActivity,
  moveActivity,
  moveActivityToDay,
  rebaseTripDates,
  reorderActivities,
  saveActivityToLibrary,
  swapDayContent,
  updateActivity,
  updateDayTitle,
  saveDayBlock,
  uploadActivityPhoto,
  uploadDocument,
} from "@/app/dashboard/trips/[id]/actions";
import DateField from "@/components/DateField";
import SubmitButton from "@/components/SubmitButton";
import {
  deleteActivityNow,
  deleteDayNow,
  restoreActivity,
  restoreDay,
  type ActivitySnapshot,
  type DaySnapshot,
} from "@/lib/actions/itineraryDelete";
import RichTextEditor from "@/components/RichTextEditor";

type ActivityWithPhotos = Activity & { activity_photos: ActivityPhoto[] };
type DayWithActivities = TripDay & { activities: ActivityWithPhotos[] };
type ActivityDocument = TripDocument & { signedUrl: string | null };
type UndoToast = {
  key: string;
  kind: "day" | "activity";
  id: string;
  label: string;
  state: "deleting" | "ready" | "undoing" | "error";
  snapshot?: ActivitySnapshot | DaySnapshot;
  undoRequested?: boolean;
  message?: string;
};

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
  mode = "activities",
}: {
  tripId: string;
  days: DayWithActivities[];
  templates: ActivityTemplate[];
  documentsByActivity: Record<string, ActivityDocument[]>;
  mode?: "activities" | "days";
}) {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(days[0]?.id ?? null);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [draggedDayId, setDraggedDayId] = useState<string | null>(null);
  const [dragOverDayId, setDragOverDayId] = useState<string | null>(null);
  const [draggedActivity, setDraggedActivity] = useState<{ id: string; sourceDayId: string } | null>(null);

  // Eliminazioni (giorni e attività): avvengono SUBITO sul server e il «Annulla» le ripristina.
  // Lo stato vive qui, a livello di itinerario, così non si perde cambiando giorno.
  const [hiddenDayIds, setHiddenDayIds] = useState<Set<string>>(new Set());
  const [hiddenActivityIds, setHiddenActivityIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<UndoToast[]>([]);
  const toastsRef = useRef<UndoToast[]>([]);
  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);
  const undoWanted = useRef<Set<string>>(new Set());
  const toastSeq = useRef(0);

  const unhide = (kind: "day" | "activity", id: string) =>
    (kind === "day" ? setHiddenDayIds : setHiddenActivityIds)((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  const patchToast = (key: string, patch: Partial<UndoToast>) =>
    setToasts((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const dropToast = (key: string) => setToasts((prev) => prev.filter((t) => t.key !== key));

  // Il messaggio sparisce da solo dopo qualche secondo (se nel frattempo non si sta annullando)
  function scheduleDismiss(key: string, ms = 8000) {
    setTimeout(() => {
      const t = toastsRef.current.find((x) => x.key === key);
      if (t && t.state !== "undoing") dropToast(key);
    }, ms);
  }

  async function runUndo(toast: UndoToast) {
    if (!toast.snapshot) return;
    patchToast(toast.key, { state: "undoing" });
    try {
      const result =
        toast.kind === "day"
          ? await restoreDay(tripId, toast.snapshot as DaySnapshot)
          : await restoreActivity(tripId, toast.snapshot as ActivitySnapshot);
      if ("error" in result) {
        patchToast(toast.key, { state: "error", message: result.error });
        scheduleDismiss(toast.key, 6000);
        return;
      }
      unhide(toast.kind, toast.id);
      dropToast(toast.key);
    } catch {
      patchToast(toast.key, { state: "error", message: "Connessione interrotta: ricarica la pagina." });
      scheduleDismiss(toast.key, 6000);
    }
  }

  async function removeItem(kind: "day" | "activity", id: string, label: string) {
    toastSeq.current += 1;
    const key = `${kind}:${id}:${toastSeq.current}`;
    (kind === "day" ? setHiddenDayIds : setHiddenActivityIds)((prev) => new Set(prev).add(id));
    setToasts((prev) => [...prev, { key, kind, id, label, state: "deleting" }]);
    try {
      const result = kind === "day" ? await deleteDayNow(tripId, id) : await deleteActivityNow(tripId, id);
      if ("error" in result) {
        unhide(kind, id);
        patchToast(key, { state: "error", message: result.error });
        scheduleDismiss(key, 6000);
        return;
      }
      const ready: UndoToast = { key, kind, id, label, state: "ready", snapshot: result.snapshot };
      if (undoWanted.current.has(key)) {
        undoWanted.current.delete(key);
        await runUndo(ready);
        return;
      }
      patchToast(key, { state: "ready", snapshot: result.snapshot });
      scheduleDismiss(key);
    } catch {
      unhide(kind, id);
      patchToast(key, { state: "error", message: "Connessione interrotta: non ho eliminato nulla. Riprova." });
      scheduleDismiss(key, 6000);
    }
  }

  function requestUndo(key: string) {
    const toast = toastsRef.current.find((t) => t.key === key);
    if (!toast) return;
    if (toast.state === "ready") void runUndo(toast);
    else if (toast.state === "deleting") {
      undoWanted.current.add(key);
      patchToast(key, { undoRequested: true });
    }
  }

  const visibleDays = days.filter((day) => !hiddenDayIds.has(day.id));
  const selectedDay = visibleDays.find((day) => day.id === selectedDayId) ?? visibleDays[0] ?? null;

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
      <aside className="grid shrink-0 grid-cols-2 gap-2 sm:sticky sm:top-20 sm:max-h-[calc(100vh-6rem)] sm:w-56 sm:self-start sm:flex sm:flex-col sm:overflow-y-auto">
        <div className="col-span-2 flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-3">
          <StartDateControl tripId={tripId} firstDate={visibleDays[0]?.day_date ?? null} hasDays={visibleDays.length > 0} />
          <form action={addDay.bind(null, tripId)}>
            <SubmitButton
              pendingLabel="Aggiungo…"
              className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              + Aggiungi giorno
            </SubmitButton>
          </form>
        </div>

        {visibleDays.map((day, index) => (
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
            mode={mode}
            onActivityDragStart={(activityId) => setDraggedActivity({ id: activityId, sourceDayId: selectedDay.id })}
            onActivityDragEnd={() => setDraggedActivity(null)}
            hiddenActivityIds={hiddenActivityIds}
            onDeleteActivity={(activity) => removeItem("activity", activity.id, activity.title)}
            onDeleteDay={() => {
              const index = visibleDays.findIndex((d) => d.id === selectedDay.id);
              void removeItem("day", selectedDay.id, dayLabel(selectedDay, index, true));
            }}
          />
        ) : (
          <p className="text-sm text-slate-500">Aggiungi il primo giorno per iniziare l&apos;itinerario.</p>
        )}
      </div>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.key} className="flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
              <span className="min-w-0 flex-1 truncate">
                {toast.state === "error"
                  ? toast.message
                  : toast.state === "undoing" || toast.undoRequested
                    ? `Ripristino «${toast.label}»…`
                    : `«${toast.label}» ${toast.kind === "day" ? "eliminato" : "eliminata"}`}
              </span>
              {(toast.state === "deleting" || toast.state === "ready") && !toast.undoRequested && (
                <button type="button" onClick={() => requestUndo(toast.key)} className="shrink-0 font-semibold text-[#ddc8a0] hover:text-[#e6d7bb]">
                  Annulla
                </button>
              )}
            </div>
          ))}
        </div>
      )}
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
        <p className="flex items-center gap-1 text-xs uppercase text-slate-500">
          <GripVertical size={12} className="text-slate-300" />
          Giorno {index + 1}
        </p>
        {isToday && (
          <span className="rounded-full bg-[#233c5e] px-2 py-0.5 text-[10px] font-semibold text-white">
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
  mode,
  hiddenActivityIds,
  onDeleteActivity,
  onActivityDragStart,
  onActivityDragEnd,
  onDeleteDay,
}: {
  day: DayWithActivities;
  tripId: string;
  templates: ActivityTemplate[];
  documentsByActivity: Record<string, ActivityDocument[]>;
  mode: "activities" | "days";
  hiddenActivityIds: Set<string>;
  onDeleteActivity: (activity: ActivityWithPhotos) => void;
  onActivityDragStart: (activityId: string) => void;
  onActivityDragEnd: () => void;
  onDeleteDay: () => void;
}) {
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [isEditingDayTitle, setIsEditingDayTitle] = useState(false);
  const [dayTitleInput, setDayTitleInput] = useState(day.title ?? "");
  const dayTitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingDayTitle) dayTitleInputRef.current?.focus();
  }, [isEditingDayTitle]);

  function saveDayTitle() {
    setIsEditingDayTitle(false);
    if (dayTitleInput.trim() !== (day.title ?? "")) {
      updateDayTitle(tripId, day.id, dayTitleInput);
    }
  }

  const sortedActivities = [...day.activities].sort((a, b) => a.activity_order - b.activity_order);
  const serverOrderKey = sortedActivities.map((a) => a.id).join(",");
  const [orderIds, setOrderIds] = useState<string[]>(sortedActivities.map((a) => a.id));
  const lastServerOrderKey = useRef(serverOrderKey);

  // Da telefono le schede aperte di default rendono la pagina lunghissima da
  // scorrere: partiamo con tutte le attività già esistenti chiuse (solo la
  // prima volta), lasciando intatto il comportamento desktop.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setCollapsedIds(new Set(sortedActivities.map((activity) => activity.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lastServerOrderKey.current !== serverOrderKey) {
      setOrderIds(sortedActivities.map((a) => a.id));
      lastServerOrderKey.current = serverOrderKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverOrderKey]);

  const allExpanded = sortedActivities.length > 0 && sortedActivities.every((a) => !collapsedIds.has(a.id));

  function toggleAllExpanded() {
    setCollapsedIds(allExpanded ? new Set(sortedActivities.map((a) => a.id)) : new Set());
  }

  const activityById = new Map(sortedActivities.map((activity) => [activity.id, activity]));
  const orderedActivities = orderIds
    .filter((id) => !hiddenActivityIds.has(id))
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
    <div className="rounded-xl border border-[#e6d7bb] bg-white p-3 sm:p-5">
      <div className="mb-3 flex flex-col gap-2 rounded-lg bg-white/95 py-1 backdrop-blur sm:sticky sm:top-4 sm:z-10 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-medium capitalize text-slate-900">
          {day.day_order === 0 ? (
            <span className="relative inline-block">
              <span
                role="button"
                tabIndex={0}
                onDoubleClick={() => setIsEditingStartDate(true)}
                title="Doppio click per impostare la data di partenza: sposta tutte le date dell'itinerario di conseguenza"
                className="cursor-pointer rounded hover:bg-[#faf3e6]"
              >
                {dayLabel(day, 0, true)}
              </span>
              {isEditingStartDate && (
                <MiniDatePicker
                  initialDate={day.day_date}
                  onCancel={() => setIsEditingStartDate(false)}
                  onConfirm={(iso) => {
                    const fd = new FormData();
                    fd.set("new_first_date", iso);
                    rebaseTripDates(tripId, fd);
                    setIsEditingStartDate(false);
                  }}
                />
              )}
            </span>
          ) : (
            dayLabel(day, 0, true)
          )}
          {" "}
          {isEditingDayTitle ? (
            <input
              ref={dayTitleInputRef}
              type="text"
              value={dayTitleInput}
              onChange={(e) => setDayTitleInput(e.target.value)}
              onBlur={saveDayTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveDayTitle();
                }
                if (e.key === "Escape") {
                  setDayTitleInput(day.title ?? "");
                  setIsEditingDayTitle(false);
                }
              }}
              placeholder="Titolo del giorno (es. Benvenuti!)"
              className="ml-1 rounded border border-[#ddc8a0] px-1.5 py-0.5 text-sm font-normal normal-case outline-none"
            />
          ) : (
            <span
              role="button"
              tabIndex={0}
              onClick={() => setIsEditingDayTitle(true)}
              title="Clicca per modificare il titolo del giorno"
              className="cursor-pointer rounded font-normal normal-case text-slate-500 hover:bg-[#faf3e6]"
            >
              {day.title ? `— ${day.title}` : "+ aggiungi titolo"}
            </span>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {mode === "activities" && sortedActivities.length > 1 && (
            <button
              type="button"
              onClick={toggleAllExpanded}
              className="flex min-h-10 items-center gap-1 rounded-md px-2 text-sm text-slate-500 hover:underline sm:min-h-0 sm:px-0 sm:text-xs"
            >
              {allExpanded ? (
                <>
                  <ChevronsUp size={12} /> Chiudi tutte
                </>
              ) : (
                <>
                  <ChevronsDown size={12} /> Apri tutte
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onDeleteDay}
            className="flex min-h-10 items-center gap-1 rounded-md px-2 text-sm text-red-500 hover:underline sm:min-h-0 sm:px-0 sm:text-xs"
          >
            <Trash2 size={12} /> Elimina giorno
          </button>
          {mode === "activities" && (
            <button
              type="button"
              onClick={() => setIsAddingActivity(true)}
              className="order-first flex min-h-11 w-full items-center justify-center gap-1 rounded-md bg-[#233c5e] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] sm:order-none sm:min-h-0 sm:w-auto"
            >
              <Plus size={15} /> Attività
            </button>
          )}
        </div>
      </div>

      {mode === "days" ? (
        <DayBlockEditor tripId={tripId} dayId={day.id} initialHtml={sortedActivities[0]?.description ?? ""} />
      ) : (
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
                onDelete={() => onDeleteActivity(activity)}
                onDragStart={() => onActivityDragStart(activity.id)}
                onDragEnd={onActivityDragEnd}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      )}
      {mode === "activities" && orderedActivities.length === 0 && <p className="mb-2 text-sm text-slate-500">Nessuna attività ancora.</p>}

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
        documents={documents}
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
        style={{ ...style, borderLeftColor: meta.color }}
        className="group overflow-hidden rounded-xl border-l-[5px] bg-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
      >
      <div style={{ backgroundColor: meta.bg }} className="flex items-center gap-1 px-1">
        <button
          type="button"
          draggable={false}
          {...attributes}
          {...listeners}
          aria-label="Trascina per riordinare"
          className="shrink-0 cursor-grab touch-none p-2 text-slate-400 opacity-60 sm:p-1 sm:text-slate-300 sm:opacity-0 transition-opacity hover:text-slate-500 focus:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full min-w-0 items-center gap-2 py-1.5 text-left"
        >
          <span
            style={{ backgroundColor: meta.color, boxShadow: `0 2px 8px -1px ${meta.color}66` }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          >
            <Icon size={17} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1 font-[family-name:var(--font-display)] text-lg font-medium text-slate-900">
            {activity.start_time && (
              <span className="mr-2 font-[family-name:var(--font-sans)] text-[15px] text-slate-500">
                {activity.start_time.slice(0, 5)}
              </span>
            )}
            {activity.title}
            {hasTimeClash && (
              <span title="Stesso orario di un'altra attività" className="ml-1.5 inline-block align-middle">
                <AlertTriangle size={13} className="text-amber-500" />
              </span>
            )}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-black/5 px-3 pb-3 pt-3 sm:pl-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
            <div className="min-w-0 flex-1">
              <span
                style={{ color: meta.color, backgroundColor: "white" }}
                className="mb-1 inline-block rounded-full px-2 py-0.5 text-[13px] font-semibold shadow-sm"
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

            <div className="flex w-full items-center justify-between gap-2 border-t border-black/5 pt-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:flex-col sm:items-end sm:gap-1 sm:border-0 sm:pt-0">
              <div className="flex items-center gap-1 sm:flex-wrap sm:justify-end">
                <form action={saveActivityToLibrary.bind(null, tripId, activity.id)}>
                  <button
                    type="submit"
                    title="Salva in libreria"
                    className="rounded-md p-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90 sm:p-2"
                  >
                    <BookmarkPlus size={18} />
                  </button>
                </form>
                <form action={duplicateActivity.bind(null, tripId, dayId, activity.id)}>
                  <button
                    type="submit"
                    title="Duplica attività"
                    className="rounded-md p-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90 sm:p-2"
                  >
                    <Copy size={18} />
                  </button>
                </form>
                <button
                  type="button"
                  onClick={onEdit}
                  title="Modifica"
                  className="rounded-md p-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 active:scale-90 sm:p-2"
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  title="Elimina"
                  className="rounded-md p-3 text-red-500 transition hover:bg-red-50 active:scale-90 sm:p-2"
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
                    className="rounded-md border border-slate-300 p-3 text-slate-500 transition hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:active:scale-100 sm:p-1.5"
                  >
                    <ChevronUp size={16} />
                  </button>
                </form>
                <form action={moveActivity.bind(null, tripId, dayId, activity.id, "down")}>
                  <button
                    type="submit"
                    disabled={index === total - 1}
                    title="Sposta giù"
                    className="rounded-md border border-slate-300 p-3 text-slate-500 transition hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:active:scale-100 sm:p-1.5"
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

          {documents.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {documents.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-700">
                    <FileText size={13} className="shrink-0 text-slate-500" />
                    {document.signedUrl ? (
                      <a
                        href={document.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-medium text-[#233c5e] hover:underline"
                      >
                        {document.file_name}
                      </a>
                    ) : (
                      <span className="truncate">{document.file_name}</span>
                    )}
                  </span>
                  <DocumentVisibilityToggle tripId={tripId} documentId={document.id} initial={Boolean(document.visible_to_client)} />
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

          <div className="mt-3 grid max-w-xl gap-2 sm:grid-cols-2">
            <UploadForm action={uploadActivityPhoto.bind(null, tripId, activity.id)}>
              <DropzoneUpload name="photo" accept="image/*" label="Carica foto" compressImages />
            </UploadForm>
            <UploadForm action={uploadDocument.bind(null, tripId, activity.id)}>
              <DropzoneUpload name="file" label="Carica documento" />
            </UploadForm>
          </div>
        </div>
      )}
      </li>
    </>
  );
}


// Data di partenza dell'itinerario: scegliendola, tutte le altre date si calcolano da sole.
function StartDateControl({ tripId, firstDate, hasDays }: { tripId: string; firstDate: string | null; hasDays: boolean }) {
  const [value, setValue] = useState(firstDate ?? "");
  const [shownFor, setShownFor] = useState(firstDate);
  const [pending, startTransition] = useTransition();

  // Se le date cambiano dal server (per esempio dopo il salvataggio) il campo le segue
  if (shownFor !== firstDate) {
    setShownFor(firstDate);
    setValue(firstDate ?? "");
  }

  if (!hasDays) return null;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="start_day_date" className="text-xs font-medium text-slate-600">
        Data di partenza
      </label>
      <DateField
        id="start_day_date"
        name="start_day_date"
        value={value}
        onChange={(next) => {
          setValue(next);
          if (!next) return;
          const fd = new FormData();
          fd.set("new_first_date", next);
          startTransition(async () => {
            await rebaseTripDates(tripId, fd);
          });
        }}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#cda876]"
      />
      <p className="text-[11px] leading-snug text-slate-500">
        {pending ? "Aggiorno le date…" : "Le date degli altri giorni si calcolano da sole."}
      </p>
    </div>
  );
}


// Itinerario "per giornata intera": un solo blocco di testo per il giorno, con tutte le attività
// elencate. Si salva da solo poco dopo l'ultima modifica.
function DayBlockEditor({ tripId, dayId, initialHtml }: { tripId: string; dayId: string; initialHtml: string }) {
  const [html, setHtml] = useState(initialHtml);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initialHtml);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function onChange(next: string) {
    setHtml(next);
    latest.current = next;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const result = await saveDayBlock(tripId, dayId, latest.current).catch(() => ({ error: "x" }));
      setStatus("error" in result ? "error" : "saved");
    }, 900);
  }

  return (
    <div className="mb-2">
      <RichTextEditor value={html} onChange={onChange} placeholder="Scrivi il programma della giornata: elenca le attività, magari con gli orari…" />
      <p className="mt-1 h-4 text-xs text-slate-500" aria-live="polite">
        {status === "saving" && "Salvo…"}
        {status === "saved" && "Salvato"}
        {status === "error" && <span className="text-red-600">Non è stato possibile salvare: riprova.</span>}
      </p>
    </div>
  );
}
