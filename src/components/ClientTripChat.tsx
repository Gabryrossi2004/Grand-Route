"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Pencil } from "lucide-react";
import Modal from "@/components/Modal";
import { useTripRealtime } from "@/lib/useTripRealtime";
import TripDialoguePanel, { type DayOption, type PanelPreset } from "@/components/TripDialoguePanel";
import ZefiroClientChat from "@/components/ZefiroClientChat";
import { ASSISTANT_NAME } from "@/lib/assistant";
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
  stage,
  zefiroEnabled = false,
}: {
  tripId: string;
  messages: TripMessage[];
  days: DayOption[];
  approvalStatus: ApprovalStatus;
  agencyLabel: string;
  stage: "preliminare" | "finale";
  // Zefiro risponde alle domande sul viaggio (se l'agenzia lo ha acceso)
  zefiroEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"agency" | "zefiro">("agency");
  // Il numero dei messaggi nuovi si aggiorna anche a chat chiusa
  useTripRealtime(tripId, !open);
  const [preset, setPreset] = useState<PanelPreset | undefined>(undefined);
  // Messaggi già visti aprendo la chat: il numero sparisce subito, senza aspettare il server
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const unread = open
    ? 0
    : messages.filter((m) => m.author_role === "agency" && !m.read_at && !seen.has(m.id)).length;
  useEffect(() => {
    if (!open) return;
    setSeen((current) => {
      const next = new Set(current);
      for (const m of messages) if (m.author_role === "agency") next.add(m.id);
      return next;
    });
  }, [open, messages]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      setPreset((event as CustomEvent<PanelPreset | undefined>).detail);
      setTab("agency");
      setOpen(true);
    };
    window.addEventListener(OPEN_TRIP_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TRIP_CHAT_EVENT, onOpen);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPreset(undefined);
          setTab("agency");
          setOpen(true);
        }}
        className="fixed bottom-4 left-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-[#233c5e] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-[#17283f] print:hidden"
      >
        <MessageCircle size={18} />
        {zefiroEnabled ? `Chat e ${ASSISTANT_NAME}` : "Chat con l'agenzia"}
        {unread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#cda876] px-1 text-xs font-bold text-[#17283f]">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <Modal title={zefiroEnabled ? "Chat" : "Chat con l'agenzia"} onClose={() => setOpen(false)}>
          {zefiroEnabled && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-[#f1e6cf] p-1 text-sm font-medium" role="tablist">
              {(
                [
                  ["agency", "Agenzia"],
                  ["zefiro", ASSISTANT_NAME],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`min-h-10 rounded-full px-3 py-1.5 transition ${
                    tab === id ? "bg-white text-[#233c5e] shadow-sm" : "text-[#6b5f4a] hover:text-[#233c5e]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {zefiroEnabled && tab === "zefiro" ? (
            <ZefiroClientChat
              tripId={tripId}
              onAskAgency={(draft) => {
                setPreset({ mode: "message", text: draft });
                setTab("agency");
              }}
            />
          ) : (
          <TripDialoguePanel
            key={`${preset?.activityId ?? ""}-${preset?.mode ?? ""}-${preset?.text ?? ""}`}
            preset={preset}
            tripId={tripId}
            role="client"
            messages={messages}
            days={days}
            approvalStatus={approvalStatus}
            agencyLabel={agencyLabel}
            stage={stage}
            zefiroHint={zefiroEnabled}
          />
          )}
        </Modal>
      )}
    </>
  );
}

// Pulsante su ogni attività: apre la richiesta di modifica già riferita a quella attività.
export function ActivityChangeButton({ activityId }: { activityId: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent(OPEN_TRIP_CHAT_EVENT, { detail: { activityId, mode: "changes" } }))
      }
      className="flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-current/30 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-white print:hidden"
    >
      <Pencil size={12} /> Chiedi una modifica
    </button>
  );
}

// Banner in cima alla pagina del viaggio quando l'agenzia aspetta una risposta.
export function ApprovalBanner({
  approvalStatus,
  stage,
}: {
  approvalStatus: ApprovalStatus;
  stage: "preliminare" | "finale";
}) {
  if (approvalStatus !== "pending" || stage !== "preliminare") return null;
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
