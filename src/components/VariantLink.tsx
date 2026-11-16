"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import { deleteTripVariant } from "@/app/dashboard/trips/[id]/actions";

const LONG_PRESS_MS = 550;

// Stesso pattern di TripCard (tasto destro / pressione prolungata per
// eliminare, con doppia conferma), applicato al link compatto di una
// variante dentro "Varianti di questo viaggio".
export default function VariantLink({
  currentTripId,
  variant,
}: {
  currentTripId: string;
  variant: { id: string; title: string; is_published: boolean };
}) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  const [deleteState, confirmDelete, deleting] = useActionState(async () => {
    const result = await deleteTripVariant(currentTripId, variant.id);
    if (!result) setConfirmOpen(false);
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
        href={`/dashboard/trips/${variant.id}`}
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
        title="Tasto destro (o tieni premuto) per eliminare questa variante"
        className="flex items-center gap-1.5 rounded-full border border-[#e6d7bb] bg-white px-3 py-1 text-sm font-medium text-[#233c5e] transition hover:bg-[#faf3e6]"
      >
        {variant.title}
        {!variant.is_published && <span className="text-xs text-slate-500">(bozza)</span>}
      </Link>

      {menuPos && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuPos(null)}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div
            style={{ top: menuPos.y, left: menuPos.x }}
            className="fixed z-50 min-w-[200px] rounded-lg border border-[#e6d7bb] bg-white py-1 shadow-xl"
          >
            <button
              type="button"
              onClick={() => {
                setMenuPos(null);
                setConfirmOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} /> Elimina variante
            </button>
          </div>
        </>
      )}

      {confirmOpen && (
        <Modal title="Eliminare questa variante?" onClose={() => setConfirmOpen(false)}>
          <p className="text-sm text-slate-600">
            Stai per eliminare definitivamente <strong>&quot;{variant.title}&quot;</strong>, con tutto
            l&apos;itinerario, i documenti e le foto collegate. Questa azione non si può annullare.
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
