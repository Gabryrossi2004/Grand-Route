"use client";

import { useEffect, useRef, useState } from "react";
import { useTripRealtime } from "@/lib/useTripRealtime";
import type { PreflightIssue } from "@/lib/tripPreflight";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareWarning, Send } from "lucide-react";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import AssistantIcon from "@/components/AssistantIcon";
import { useI18n } from "@/components/I18nProvider";
import { DRAFT_KINDS, type DraftKind } from "@/lib/messageDrafts";
import { draftClientMessage } from "@/lib/actions/zefiroAgency";
import { templateMessage } from "@/lib/actions/messageTemplates";
import { TEMPLATE_KINDS, type TemplateKind } from "@/lib/messageTemplates";
import type { ApprovalStatus, TripMessage } from "@/lib/types";
import {
  approveTrip,
  markTripMessagesRead,
  requestTripChanges,
  sendTripForApproval,
  sendTripMessage,
} from "@/lib/actions/tripDialogue";

export type DayOption = { id: string; label: string; activities?: { id: string; label: string }[] };
export type PanelPreset = { activityId?: string; mode?: "message" | "changes"; text?: string };

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  none: "bg-slate-100 text-slate-600",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  changes_requested: "bg-orange-100 text-orange-800",
};

// Vista dell'agenzia o del cliente: cambiano le parole ("In attesa del cliente" / "In attesa della tua risposta")
export function ApprovalChip({ status, role = "agency" }: { status: ApprovalStatus; role?: "agency" | "client" }) {
  const { t } = useI18n();
  const key = (
    role === "client"
      ? ({ none: "chat.status.none", pending: "chat.status.pendingClient", approved: "chat.status.approvedClient", changes_requested: "chat.status.changesClient" } as const)
      : ({ none: "chat.status.none", pending: "chat.status.pending", approved: "chat.status.approved", changes_requested: "chat.status.changes_requested" } as const)
  )[status ?? "none"];
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.none;
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold normal-case tracking-normal ${style}`}>{t(key)}</span>;
}

function formatWhen(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
  stage = "preliminare",
  zefiroHint = false,
  extra,
  preflight = [],
}: {
  tripId: string;
  role: "agency" | "client";
  messages: TripMessage[];
  days: DayOption[];
  approvalStatus: ApprovalStatus;
  agencyLabel?: string;
  preset?: PanelPreset;
  // Approvazione e richieste di modifica hanno senso solo finché l'itinerario è preliminare
  stage?: "preliminare" | "finale";
  // Lato cliente: ricorda che fuori orario si può chiedere a Zefiro
  zefiroHint?: boolean;
  // Contenuto in fondo (usato dall'agenzia per l'impostazione di Zefiro)
  extra?: React.ReactNode;
  // Controlli da mostrare all'agenzia prima di inviare l'itinerario al cliente
  preflight?: PreflightIssue[];
}) {
  const [showPreflight, setShowPreflight] = useState(false);
  const [drafting, setDrafting] = useState<DraftKind | `t:${TemplateKind}` | null>(null);
  const { t, locale } = useI18n();
  const canApprove = stage === "preliminare";
  const router = useRouter();
  const [text, setText] = useState(preset?.text ?? "");
  // A cosa si riferisce il messaggio: "" (tutto il viaggio), "day:<id>" o "activity:<id>"
  const [ref, setRef] = useState(preset?.activityId ? `activity:${preset.activityId}` : "");
  const [mode, setMode] = useState<"message" | "changes">(preset?.mode ?? "message");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Conferma visibile e messaggio mostrato subito, in attesa che il server confermi
  const [notice, setNotice] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<TripMessage[]>([]);
  const [statusOverride, setStatusOverride] = useState<ApprovalStatus | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Quando arrivano i dati veri dal server, quelli provvisori non servono più
  useEffect(() => {
    setStatusOverride(null);
    setOptimistic((current) =>
      current.filter((o) => !messages.some((m) => m.author_role === o.author_role && m.kind === o.kind && m.body === o.body)),
    );
  }, [messages, approvalStatus]);

  const shownMessages = [...messages, ...optimistic];
  const shownStatus = statusOverride ?? approvalStatus;

  const unread = messages.filter((m) => m.author_role !== role && !m.read_at).length;

  // Segna come letti i messaggi dell'altra parte quando si apre la conversazione
  useEffect(() => {
    if (unread > 0) {
      markTripMessagesRead(tripId)
        .then(() => router.refresh())
        .catch(() => {});
    }
  }, [unread, tripId, router]);

  // La casella di scrittura cresce con il testo (fino a metà schermo), così una
  // bozza lunga si legge tutta senza scorrere dentro una casella di tre righe
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, Math.round(window.innerHeight * 0.55))}px`;
  }, [text, mode]);

  // Scorre in fondo ai messaggi nuovi
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [shownMessages.length]);

  // Nuovi messaggi in tempo reale, più un aggiornamento di riserva ogni tanto
  useTripRealtime(tripId);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [router]);

  function addLocal(kind: TripMessage["kind"], body: string, dayId: string | null, activityId: string | null) {
    setOptimistic((current) => [
      ...current,
      {
        id: `tmp-${Date.now()}`,
        trip_id: tripId,
        author_id: "",
        author_role: role,
        kind,
        body,
        day_id: dayId,
        activity_id: activityId,
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  async function run(
    action: () => Promise<{ ok: true } | { error: string }>,
    after?: () => void,
    confirmation?: string,
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if ("error" in result) setError(result.error);
      else {
        after?.();
        if (confirmation) {
          setNotice(confirmation);
          setTimeout(() => setNotice(null), 6000);
        }
        router.refresh();
      }
    } catch {
      setError(t("chat.sendError"));
    } finally {
      setBusy(false);
    }
  }

  // Zefiro scrive una bozza e la mette nella casella: da rileggere e modificare, non parte da sola
  // Modello pronto compilato con i dati del viaggio (senza AI)
  async function applyTemplate(kind: TemplateKind) {
    setDrafting(`t:${kind}`);
    setError(null);
    setNotice(null);
    try {
      const result = await templateMessage(tripId, kind);
      if (result.error || !result.text) setError(result.error ?? "Modello non disponibile.");
      else {
        setText(result.text.slice(0, 2000));
        setNotice("Modello compilato con i dati del viaggio: rileggilo e modificalo prima di inviarlo.");
        requestAnimationFrame(() => textRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
      }
    } catch {
      setError("Non è stato possibile preparare il modello. Riprova.");
    } finally {
      setDrafting(null);
    }
  }

  async function draft(kind: DraftKind) {
    setDrafting(kind);
    setError(null);
    setNotice(null);
    try {
      const result = await draftClientMessage(tripId, kind, text);
      if ("error" in result) setError(result.error);
      else {
        setText(result.message.slice(0, 2000));
        setNotice("Bozza di Zefiro: rileggila e modificala prima di inviarla.");
        // Porta la bozza in vista (la casella si allarga da sola)
        requestAnimationFrame(() => textRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
      }
    } catch {
      setError("Non è stato possibile scrivere la bozza. Controlla la connessione e riprova.");
    } finally {
      setDrafting(null);
    }
  }

  function doSend() {
    setShowPreflight(false);
    run(
      () => sendTripForApproval(tripId),
      () => {
        addLocal("sent_for_approval", "Ti ho inviato l'itinerario: guardalo con calma e poi approvalo, oppure chiedimi le modifiche.", null, null);
        setStatusOverride("pending");
      },
      "Itinerario inviato al cliente per l'approvazione ✓",
    );
  }

  function submit() {
    const dayId = ref.startsWith("day:") ? ref.slice(4) : null;
    const activityId = ref.startsWith("activity:") ? ref.slice(9) : null;
    const body = text.trim();
    if (mode === "changes") {
      run(
        () => requestTripChanges(tripId, text, dayId, activityId),
        () => {
          addLocal("change_request", body, dayId, activityId);
          setStatusOverride("changes_requested");
          setText("");
          setRef("");
          setMode("message");
        },
        t("chat.noticeRequest"),
      );
    } else {
      run(
        () => sendTripMessage(tripId, text, dayId, activityId),
        () => {
          addLocal("message", body, dayId, activityId);
          setText("");
          setRef("");
        },
        t("chat.noticeMessage"),
      );
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
        {canApprove && <ApprovalChip status={shownStatus} role={role} />}
        {role === "agency" && canApprove && (
          <button
            type="button"
            disabled={busy}
            onClick={() => (preflight.some((i) => i.level !== "nota") ? setShowPreflight(true) : doSend())}
            className="rounded-md bg-[#233c5e] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
          >
            {shownStatus === "none" ? "Invia al cliente per approvazione" : "Invia di nuovo per approvazione"}
          </button>
        )}
        {role === "client" && canApprove && shownStatus === "pending" && mode === "message" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  () => approveTrip(tripId),
                  () => {
                    addLocal("approved", "Itinerario approvato", null, null);
                    setStatusOverride("approved");
                  },
                  t("chat.noticeApproval"),
                )
              }
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
            >
              <CheckCircle2 size={16} /> {t("chat.approve")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("changes")}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-[#cda876] bg-white px-4 py-2 text-sm font-semibold text-[#233c5e] hover:bg-[#faf3e6]"
            >
              <MessageSquareWarning size={16} /> {t("chat.askChanges")}
            </button>
          </>
        )}
      </div>

      {showPreflight && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <p className="mb-1.5 font-semibold">Prima di inviare, controlla:</p>
          <ul className="mb-3 flex flex-col gap-1">
            {preflight.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{issue.level === "problema" ? "⛔" : issue.level === "attenzione" ? "⚠️" : "ℹ️"}</span>
                <span>{issue.text}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowPreflight(false)}
              className="min-h-10 rounded-lg bg-[#233c5e] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#17283f]"
            >
              Torna a modificare
            </button>
            <button
              type="button"
              onClick={doSend}
              disabled={preflight.some((i) => i.level === "problema")}
              className="min-h-10 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              Invia comunque
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-800">
            Per una rilettura più approfondita usa «Suggerimenti» di Zefiro, nella scheda del viaggio.
          </p>
        </div>
      )}

      <div className="flex max-h-[45vh] min-h-32 flex-col gap-2 overflow-y-auto rounded-xl bg-[#faf3e6]/60 p-3" aria-live="polite">
        {shownMessages.length === 0 && (
          <p className="m-auto text-center text-sm text-slate-500">
            {role === "client"
              ? `${t("chat.emptyClient")}${zefiroHint ? t("chat.emptyZefiroHint") : ""}`
              : canApprove
                ? "Nessun messaggio. Scrivi al cliente o invia l'itinerario in approvazione."
                : "Nessun messaggio. Scrivi al cliente quando vuoi."}
          </p>
        )}
        {shownMessages.map((m) => {
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
                {m.kind === "approved" && <span className="mb-0.5 block text-xs font-semibold">{t("chat.kind.approved")}</span>}
                {m.kind === "change_request" && <span className="mb-0.5 block text-xs font-semibold">{t("chat.kind.change")}</span>}
                {m.kind === "sent_for_approval" && <span className="mb-0.5 block text-xs font-semibold opacity-80">{t("chat.kind.sent")}</span>}
                {reference && <span className="mb-0.5 block text-xs opacity-80">{reference}</span>}
                {m.kind === "approved" ? null : (
                  <span className="whitespace-pre-line break-words">
                    {m.kind === "sent_for_approval" && role === "client" ? t("chat.sentBody") : m.body}
                  </span>
                )}
              </div>
              <span className="px-1 text-[11px] text-slate-500">
                {m.author_role === "agency" ? agencyLabel : t("common.client")} · {formatWhen(m.created_at, locale)}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2">
        {mode === "changes" && (
          <p className="text-sm font-medium text-[#233c5e]">{t("chat.whatChange")}</p>
        )}
        {days.length > 0 && (
          <select
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            aria-label={t("chat.refAria")}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">{t("chat.refAll")}</option>
            {days.map((d) => (
              <optgroup key={d.id} label={d.label}>
                <option value={`day:${d.id}`}>{t("chat.refDay", { day: d.label.toLowerCase() })}</option>
                {(d.activities ?? []).map((a) => (
                  <option key={a.id} value={`activity:${a.id}`}>
                    {a.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        {role === "agency" && (
          <div className="rounded-xl border border-[#e6d7bb] bg-[#faf3e6]/60 p-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <AssistantIcon size={16} /> Zefiro scrive per me
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DRAFT_KINDS.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  onClick={() => draft(kind.id)}
                  disabled={drafting !== null || (kind.id === "migliora" && !text.trim())}
                  className="min-h-9 rounded-full border border-[#e6d7bb] bg-white px-3 py-1 text-xs font-medium text-[#233c5e] transition hover:bg-[#faf3e6] disabled:opacity-50"
                >
                  {drafting === kind.id ? "Scrivo…" : kind.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Se scrivi qualche nota nella casella prima di toccare un pulsante, Zefiro ne tiene conto.
            </p>
            <p className="mb-1.5 mt-3 text-xs font-medium text-slate-600">Modelli pronti (gratis, senza AI)</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_KINDS.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  onClick={() => applyTemplate(kind.id)}
                  disabled={drafting !== null}
                  className="min-h-9 rounded-full border border-dashed border-[#c58f2d] bg-white px-3 py-1 text-xs font-medium text-[#233c5e] transition hover:bg-[#faf3e6] disabled:opacity-50"
                >
                  {drafting === `t:${kind.id}` ? "Compilo…" : kind.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={mode === "changes" ? 4 : 3}
          placeholder={mode === "changes" ? t("chat.placeholderChange") : t("chat.placeholderMessage")}
          className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#cda876]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={submit}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-50"
          >
            <Send size={15} /> {mode === "changes" ? t("chat.sendRequest") : t("common.send")}
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
              {t("common.cancel")}
            </button>
          )}
        </div>
        {notice && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-[#f2e2c4] pt-3">
        <p className="mb-1 text-xs text-slate-500">{t("chat.pushHint")}</p>
        <PushNotificationToggle />
      </div>
      {extra}
    </div>
  );
}
