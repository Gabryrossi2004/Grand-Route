"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import Modal from "@/components/Modal";
import TripDialoguePanel, { type DayOption } from "@/components/TripDialoguePanel";
import type { ApprovalStatus, TripMessage } from "@/lib/types";

export const OPEN_TRIP_CHAT_EVENT = "trip-chat:open";

// Lato cliente: pulsante flottante "Scrivi all'agenzia" (con i messaggi non
// letti) che apre la conversazione, e banner di richiesta di approvazione.
export default function ClientTripChat({
  tripId,
  messages,
  days,
  approvalStatus,
  agencyLabel,
}: {
  tripId: string;
  messages: TripMessage[];
  days: DayOption[];
  approvalStatus: ApprovalStatus;
  agencyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const unread = messages.filter((m) => m.author_role === "agency" && !m.read_at).length;

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_TRIP_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TRIP_CHAT_EVENT, onOpen);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-[#233c5e] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-[#17283f] print:hidden"
      >
        <MessageCircle size={18} />
        Scrivi all&apos;agenzia
        {unread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#cda876] px-1 text-xs font-bold text-[#17283f]">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <Modal title="Il tuo viaggio: messaggi" onClose={() => setOpen(false)}>
          <TripDialoguePanel
            tripId={tripId}
            role="client"
            messages={messages}
            days={days}
            approvalStatus={approvalStatus}
            agencyLabel={agencyLabel}
          />
        </Modal>
      )}
    </>
  );
}

// Banner in cima alla pagina del viaggio quando l'agenzia aspetta una risposta.
export function ApprovalBanner({ approvalStatus }: { approvalStatus: ApprovalStatus }) {
  if (approvalStatus !== "pending") return null;
  return (
    <div className="bg-[#fdf1d6] px-4 py-2.5">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_TRIP_CHAT_EVENT))}
        className="mx-auto flex w-full max-w-3xl items-center gap-2 text-left text-sm font-medium text-[#6b4e12] hover:text-[#4a360c]"
      >
        <MessageCircle size={15} className="shrink-0" />
        L&apos;agenzia ti ha inviato l&apos;itinerario: guardalo e approvalo, oppure chiedi modifiche. Tocca qui.
      </button>
    </div>
  );
}
