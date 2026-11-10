"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import type { Trip } from "@/lib/types";
import Modal from "@/components/Modal";
import { deleteTrip } from "@/app/dashboard/trips/[id]/actions";

function formatDateRange(trip: Trip) {
  if (!trip.start_date) return "Date da definire";
  const start = new Date(trip.start_date).toLocaleDateString("it-IT");
  if (!trip.end_date) return start;
  const end = new Date(trip.end_date).toLocaleDateString("it-IT");
  return `${start} – ${end}`;
}

const LONG_PRESS_MS = 550;

export default function TripCard({ trip }: { trip: Trip }) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  const [deleteState, confirmDelete, deleting] = useActionState(async () => {
    const result = await deleteTrip(trip.id);
    return result ?? null;
  }, null);

  function openMenuAt(x: number, y: number) {
    setMenuPos({ x, y });
  }

  function startLongPress(e: React.TouchEvent) {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      openMenuAt(touch.clientX, touch.clientY);
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <>
      <Link
        href={`/dashboard/trips/${trip.id}`}
        onClick={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            suppressClick.current = false;
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(e.clientX, e.clientY);
        }}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        className="group block overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#e6d7bb] hover:shadow-lg hover:shadow-slate-200/60"
      >
        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-[#f2e2c4] to-indigo-100">
          {trip.cover_image_url && (
            <Image
              src={trip.cover_image_url}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          )}
        </div>
        <div className="p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="font-medium text-slate-900">{trip.title}</h3>
            {trip.is_published && (
              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Pubblicato
              </span>
            )}
          </div>
          {trip.destination && <p className="text-sm text-slate-500">{trip.destination}</p>}
          <p className="mt-2 text-xs text-slate-400">{formatDateRange(trip)}</p>
        </div>
      </Link>

      {menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuPos(null)} onContextMenu={(e) => e.preventDefault()} />
          <div
            style={{ top: menuPos.y, left: menuPos.x }}
            className="fixed z-50 min-w-[180px] rounded-lg border border-[#e6d7bb] bg-white py-1 shadow-xl"
          >
            <button
              type="button"
              onClick={() => {
                setMenuPos(null);
                setConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} /> Elimina viaggio
            </button>
          </div>
        </>
      )}

      {confirmOpen && (
        <Modal title="Eliminare questo viaggio?" onClose={() => setConfirmOpen(false)}>
          <p className="text-sm text-slate-600">
            Stai per eliminare definitivamente <strong>&quot;{trip.title}&quot;</strong>, con tutto l&apos;itinerario,
            i documenti e le foto collegate. Questa azione non si può annullare.
          </p>
          {deleteState?.error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteState.error}</p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Annulla
            </button>
            <form action={confirmDelete}>
              <button
                type="submit"
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Eliminazione…" : "Sì, elimina definitivamente"}
              </button>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
