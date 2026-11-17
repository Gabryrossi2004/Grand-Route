"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareWarning, Send } from "lucide-react";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import type { ApprovalStatus, TripMessage } from "@/lib/types";
import {
  approveTrip,
  markTripMessagesRead,
  requestTripChanges,
  sendTripForApproval,
  sendTripMessage,
} from "@/lib/actions/tripDialogue";

export type DayOption = { id: string; label: string; activities?: { id: string; label: string }[] };
export type PanelPreset = { activityId?: string; mode?: "message" | "changes" };

const STATUS_LABEL: Record<ApprovalStatus, { text: string; className: string }> = {
  none: { text: "Non ancora inviato", className: "bg-slate-100 text-slate-600" },
  pending: { text: "In attesa del cliente", className: "bg-amber-100 text-amber-800" },
  approved: { text: "Approvato dal cliente", className: "bg-green-100 text-green-800" },
  changes_requested: { text: "Modifiche richieste", className: "bg-orange-100 text-orange-800" },
};

export function ApprovalChip({ status }: { status: ApprovalStatus }) {
  const s = STATUS_LABEL[status] ?? STATUS_LABEL.none;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>{s.text}</span>;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Conversazione e approvazione dell'itinerario, uguale per agenzia e cliente
// (cambiano i pulsanti): l'agenzia manda l'itinerario in approvazione, il
// cliente approva o chiede modifiche, e tutti e due possono scrivere.
export default function TripDialoguePanel({
  tripId,
  role,
  messages,
  days,
  approvalStatus,
  agencyLabel = "Agenzia",
  preset,
}: {
  tripId: string;
  role: "agency" | "client";
  messages: TripMessage[];
  days: DayOption[];
  approvalStatus: ApprovalStatus;
  agencyLabel?: string;
  preset?: PanelPreset;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  // A cosa si riferisce il messaggio: "" (tutto il viaggio), "day:<id>" o "activity:<id>"
  const [ref, setRef] = useState(preset?.activityId ? `activity:${preset.activityId}` : "");
  const [mode, setMode] = useState<"message" | "changes">(preset?.mode ?? "message");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const unread = messages.filter((m) => m.author_role !== role && !m.read_at).length;

  // Segna come letti i messaggi dell'altra parte quando si apre la conversazione
  useEffect(() => {
    if (unread > 0) markTripMessagesRead(tripId).catch(() => {});
  }, [unread, tripId]);

  // Scorre in fondo ai messaggi nuovi
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Aggiorna da solo ogni tanto, finché la scheda è aperta
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 20000);
    return () => clearInterval(timer);
  }, [router]);

  async function run(action: () => Promise<{ ok: true } | { error: string }>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if ("error" in result) setError(result.error);
      else {
        after?.();
        router.refresh();
      }
    } catch {
      setError("Non è stato possibile inviare. Controlla la connessione e riprova.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    const dayId = ref.startsWith("day:") ? ref.slice(4) : null;
    const activityId = ref.startsWith("activity:") ? ref.slice(9) : null;
    if (mode === "changes") {
      run(() => requestTripChanges(tripId, text, dayId, activityId), () => {
        setText("");
        setRef("");
        setMode("message");
      });
    } else {
      run(() => sendTripMessage(tripId, text, dayId, activityId), () => {
        setText("");
        setRef("");
      });
    }
  }

  function refLabel(m: TripMessage) {
    if (m.activity_id) {
      for (const d of days) {
        const a = d.activities?.find((x) => x.id === m.activity_id);
        if (a) return `${d.label} — ${a.label}`;
      }
    }
    return days.find((d) => d.id === m.day_id)?.label;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ApprovalChip status={approvalStatus} />
        {role === "agency" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => sendTripForApproval(tripId))}
            className="rounded-md bg-[#233c5e] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
          >
            {approvalStatus === "none" ? "Invia al cliente per approvazione" : "Invia di nuovo per approvazione"}
          </button>
        )}
        {role === "client" && approvalStatus === "pending" && mode === "message" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => approveTrip(tripId))}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              <CheckCircle2 size={16} /> Approva l&apos;itinerario
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("changes")}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-[#cda876] bg-white px-4 py-2 text-sm font-semibold text-[#233c5e] hover:bg-[#faf3e6]"
            >
              <MessageSquareWarning size={16} /> Chiedi modifiche
            </button>
          </>
        )}
      </div>

      <div className="flex max-h-[45vh] min-h-32 flex-col gap-2 overflow-y-auto rounded-xl bg-[#faf3e6]/60 p-3" aria-live="polite">
        {messages.length === 0 && (
          <p className="m-auto text-center text-sm text-slate-500">
            {role === "client"
              ? "Nessun messaggio. Scrivi qui se hai domande sul viaggio."
              : "Nessun messaggio. Scrivi al cliente o invia l'itinerario in approvazione."}
          </p>
        )}
        {messages.map((m) => {
          const mine = m.author_role === role;
          const reference = refLabel(m);
          return (
            <div key={m.id} className={`flex max-w-[85%] flex-col gap-0.5 ${mine ? "self-end items-end" : "self-start"}`}>
              <div
                className={`rounded-2xl px-3.5 py-2 text-sm ${
                  m.kind === "approved"
                    ? "bg-green-100 text-green-900"
                    : m.kind === "change_request"
                      ? "bg-orange-100 text-orange-900"
                      : mine
                        ? "bg-[#233c5e] text-white"
                        : "bg-white text-slate-800 shadow-sm"
                }`}
              >
                {m.kind === "approved" && <span className="mb-0.5 block text-xs font-semibold">✓ Itinerario approvato</span>}
                {m.kind === "change_request" && <span className="mb-0.5 block text-xs font-semibold">Richiesta di modifica</span>}
                {m.kind === "sent_for_approval" && <span className="mb-0.5 block text-xs font-semibold opacity-80">Inviato per approvazione</span>}
                {reference && <span className="mb-0.5 block text-xs opacity-80">{reference}</span>}
                <span className="whitespace-pre-line break-words">{m.body}</span>
              </div>
              <span className="px-1 text-[11px] text-slate-500">
                {m.author_role === "agency" ? agencyLabel : "Cliente"} · {formatWhen(m.created_at)}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2">
        {mode === "changes" && (
          <p className="text-sm font-medium text-[#233c5e]">Cosa vuoi cambiare nell&apos;itinerario?</p>
        )}
        {days.length > 0 && (
          <select
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            aria-label="Giorno o attività a cui si riferisce"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Riguarda tutto il viaggio</option>
            {days.map((d) => (
              <optgroup key={d.id} label={d.label}>
                <option value={`day:${d.id}`}>Tutto il {d.label.toLowerCase()}</option>
                {(d.activities ?? []).map((a) => (
                  <option key={a.id} value={`activity:${a.id}`}>
                    {a.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={mode === "changes" ? 4 : 3}
          placeholder={mode === "changes" ? "Es. Vorrei un hotel più vicino al centro nel giorno 2" : "Scrivi un messaggio…"}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={submit}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-50"
          >
            <Send size={15} /> {mode === "changes" ? "Invia la richiesta" : "Invia"}
          </button>
          {mode === "changes" && (
            <button
              type="button"
              onClick={() => {
                setMode("message");
                setText("");
              }}
              className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Annulla
            </button>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-[#f2e2c4] pt-3">
        <p className="mb-1 text-xs text-slate-500">Ricevi un avviso sul telefono quando arriva una risposta:</p>
        <PushNotificationToggle />
      </div>
    </div>
  );
}
