"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, Download, FileText, Forward, Inbox, Mail, MailOpen, Paperclip, Sparkles, Star, UserPlus, X } from "lucide-react";
import Composer from "@/components/mail/Composer";
import OrderCard from "@/components/orders/OrderCard";
import { addParticipant, attachmentUrl, forwardMessage, setThreadState, summarizeWithZefiro } from "@/lib/actions/mail";
import { fileSize, initials, mailDateFull, type MailAttachment, type MailMessage } from "@/lib/mail/shared";
import type { OrderPartner, OrderRow } from "@/lib/orders/shared";
import type { MailSummary } from "@/lib/mailAi";

type Person = { id: string; name: string };

// Testo del messaggio con i link cliccabili (niente HTML: solo testo e a capo)
function Body({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="text-[#233c5e] underline">{p}</a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </p>
  );
}

function Attachments({ list, thumbs }: { list: MailAttachment[]; thumbs: Record<string, string> }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!list.length) return null;
  const open = async (a: MailAttachment) => {
    setBusy(a.id);
    const r = await attachmentUrl(a.path, a.name);
    setBusy(null);
    if (r.ok) window.open(r.url, "_blank", "noopener");
  };
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {list.map((a) =>
        thumbs[a.id] ? (
          <button key={a.id} type="button" onClick={() => open(a)} className="overflow-hidden rounded-xl border border-[#e6d7bb] bg-white text-left" title={a.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbs[a.id]} alt={a.name} className="h-28 w-40 object-cover" loading="lazy" />
            <span className="block max-w-40 truncate px-2 py-1 text-xs text-slate-600">{a.name}</span>
          </button>
        ) : (
          <button key={a.id} type="button" onClick={() => open(a)} className="flex max-w-full items-center gap-2 rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-left text-sm hover:border-[#c58f2d]">
            <FileText size={18} className="shrink-0 text-[#c58f2d]" />
            <span className="min-w-0">
              <span className="block max-w-[14rem] truncate font-medium text-slate-800">{a.name}</span>
              <span className="text-xs text-slate-500">{fileSize(a.size_bytes)}</span>
            </span>
            <Download size={15} className={`shrink-0 ${busy === a.id ? "animate-pulse" : ""} text-slate-400`} />
          </button>
        ),
      )}
    </div>
  );
}

export default function ThreadView({
  base,
  me,
  thread,
  people,
  messages,
  attachments,
  thumbs,
  order,
  partners,
  invoiceBase,
}: {
  base: string;
  me: string;
  thread: { id: string; subject: string; starred: boolean; archived: boolean; kind: string };
  people: Person[];
  messages: MailMessage[];
  attachments: MailAttachment[];
  thumbs: Record<string, string>;
  order: OrderRow | null;
  partners: OrderPartner[];
  invoiceBase: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<MailSummary | null>(null);
  const [forwarding, setForwarding] = useState<string | null>(null);
  const [fwTo, setFwTo] = useState<string[]>([]);
  const [fwNote, setFwNote] = useState("");
  const [adding, setAdding] = useState(false);

  const nameOf = (id: string | null) => (id === me ? "Tu" : people.find((p) => p.id === id)?.name ?? "Grand Route");
  const others = people.filter((p) => p.id !== me);
  const byMessage = (id: string) => attachments.filter((a) => a.message_id === id);
  const realMessages = messages.filter((m) => m.kind === "messaggio");
  const lastReal = realMessages[realMessages.length - 1]?.id;

  // Come in Outlook: il più recente in alto, sotto la risposta. Nelle conversazioni lunghe si vedono gli ultimi
  // messaggi e il primo (in fondo); quelli in mezzo si aprono con un tocco.
  const KEEP = 5;
  const newestFirst = [...messages].reverse();
  const hidden = !showAll && newestFirst.length > KEEP + 2 ? newestFirst.slice(KEEP, newestFirst.length - 1) : [];
  const visible = hidden.length ? [...newestFirst.slice(0, KEEP), newestFirst[newestFirst.length - 1]] : newestFirst;
  const openByDefault = (id: string, idx: number) => id === lastReal || idx < 3;

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Errore");
      else {
        after?.();
        router.refresh();
      }
    });

  const tool = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-[#faf3e6] disabled:opacity-50";

  return (
    <div>
      <Link href={base} className="mb-3 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Posta
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-[#233c5e] sm:text-3xl">{thread.subject}</h1>
          <p className="mt-1 text-sm text-slate-600">Con {others.map((p) => p.name).join(", ") || "—"}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1 border-y border-[#f2e2c4] py-1.5">
        <button type="button" disabled={pending} onClick={() => act(() => setThreadState(thread.id, { starred: !thread.starred }))} className={tool}>
          <Star size={15} className={thread.starred ? "fill-[#c58f2d] text-[#c58f2d]" : ""} /> {thread.starred ? "Togli la stella" : "Stella"}
        </button>
        <button type="button" disabled={pending} onClick={() => act(() => setThreadState(thread.id, { archived: !thread.archived }), () => !thread.archived && router.push(base))} className={tool}>
          {thread.archived ? <Inbox size={15} /> : <Archive size={15} />} {thread.archived ? "Riporta in arrivo" : "Archivia"}
        </button>
        <button type="button" disabled={pending} onClick={() => act(() => setThreadState(thread.id, { read: false }), () => router.push(base))} className={tool}>
          <Mail size={15} /> Segna come non letto
        </button>
        <button type="button" onClick={() => setAdding((v) => !v)} className={tool}><UserPlus size={15} /> Aggiungi un partner</button>
        <button type="button" disabled={pending} onClick={() => start(async () => { setError(null); const r = await summarizeWithZefiro(thread.id); if (r.ok) setSummary(r.summary); else setError(r.error); })} className={`${tool} text-[#8a5a12]`}>
          <Sparkles size={15} /> Riassumi con Zefiro
        </button>
      </div>
      {adding && (
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl bg-[#faf3e6] p-3 text-sm">
          {partners.filter((p) => !people.some((x) => x.id === p.user_id)).map((p) => (
            <button key={p.user_id} type="button" disabled={pending} onClick={() => act(() => addParticipant(thread.id, p.user_id), () => setAdding(false))} className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1 text-[#233c5e] hover:border-[#c58f2d]">
              + {p.name}
            </button>
          ))}
          <span className="w-full text-xs text-slate-500">Chi aggiungi vede anche i messaggi precedenti della conversazione.</span>
        </div>
      )}
      {summary && (
        <div className="mt-3 rounded-2xl border border-[#e6d7bb] bg-[#fffaf0] p-4 text-sm text-slate-700">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-2 font-semibold text-[#8a5a12]"><Sparkles size={15} /> Riassunto di Zefiro</p>
            <button type="button" onClick={() => setSummary(null)} className="text-slate-400" aria-label="Chiudi"><X size={16} /></button>
          </div>
          <p className="mt-1">{summary.summary}</p>
          {summary.agreed.length > 0 && (<><p className="mt-2 font-medium text-slate-800">Concordato</p><ul className="list-disc pl-5">{summary.agreed.map((a) => <li key={a}>{a}</li>)}</ul></>)}
          {summary.open.length > 0 && (<><p className="mt-2 font-medium text-slate-800">In sospeso</p><ul className="list-disc pl-5">{summary.open.map((a) => <li key={a}>{a}</li>)}</ul></>)}
          <p className="mt-2 text-xs text-slate-400">Zefiro può sbagliare: fa fede il testo dei messaggi.</p>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {order && (
        <div className="mt-4">
          <OrderCard order={order} me={me} invoiceBase={invoiceBase} defaultOpen={order.phase === "da_confermare"} inThread />
        </div>
      )}

      <div className="mt-4" id="rispondi">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#233c5e]"><MailOpen size={16} /> Rispondi a tutti</p>
        <Composer threadId={thread.id} base={base} compact />
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Conversazione · {realMessages.length === 1 ? "1 messaggio" : `${realMessages.length} messaggi`}, dal più recente
      </p>

      <div className="mt-2 space-y-3">
        {visible.map((m, idx) => (
          <Fragment key={m.id}>
            {hidden.length > 0 && idx === visible.length - 1 && (
              <button type="button" onClick={() => setShowAll(true)} className="w-full rounded-xl border border-dashed border-[#e6d7bb] py-2 text-sm font-medium text-[#233c5e] hover:bg-[#faf3e6]">
                Mostra {hidden.length} messaggi precedenti
              </button>
            )}
            {m.kind === "evento" ? (
              <p className="px-2 text-center text-xs text-slate-500">
                <span className="font-medium text-slate-600">{nameOf(m.author_id)}</span> · {m.body} · {mailDateFull(m.created_at)}
              </p>
            ) : (
              <article className="rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [m.id]: !(e[m.id] ?? openByDefault(m.id, idx)) }))}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${m.author_id === me ? "bg-[#233c5e] text-white" : "bg-[#f2e2c4] text-[#233c5e]"}`}>
                    {initials(nameOf(m.author_id))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold text-slate-900">{nameOf(m.author_id)}</span>
                      <span className="text-xs text-slate-500">{mailDateFull(m.created_at)}</span>
                    </span>
                    {!(expanded[m.id] ?? openByDefault(m.id, idx)) && (
                      <span className="block truncate text-sm text-slate-500">
                        {m.body.replace(/\s+/g, " ").slice(0, 140)}
                        {byMessage(m.id).length > 0 && <Paperclip size={12} className="ml-1 inline" />}
                      </span>
                    )}
                  </span>
                </button>
                {(expanded[m.id] ?? openByDefault(m.id, idx)) && (
                  <div className="mt-3 pl-0 sm:pl-12">
                    <Body text={m.body} />
                    <Attachments list={byMessage(m.id)} thumbs={thumbs} />
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => { setForwarding(m.id); setFwTo([]); setFwNote(""); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#233c5e]">
                        <Forward size={14} /> Inoltra
                      </button>
                    </div>
                    {forwarding === m.id && (
                      <div className="mt-2 space-y-2 rounded-xl bg-[#faf3e6] p-3 text-sm">
                        <p className="font-medium text-slate-700">Inoltra a</p>
                        <div className="flex flex-wrap gap-1.5">
                          {partners.map((p) => (
                            <button key={p.user_id} type="button" onClick={() => setFwTo(fwTo.includes(p.user_id) ? fwTo.filter((x) => x !== p.user_id) : [...fwTo, p.user_id])} aria-pressed={fwTo.includes(p.user_id)} className={`rounded-full border px-3 py-1 ${fwTo.includes(p.user_id) ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e]"}`}>
                              {p.name}
                            </button>
                          ))}
                        </div>
                        <textarea value={fwNote} onChange={(e) => setFwNote(e.target.value)} rows={2} placeholder="Aggiungi una nota (facoltativa)" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                        <div className="flex gap-2">
                          <button type="button" disabled={pending || fwTo.length === 0} onClick={() => start(async () => { setError(null); const r = await forwardMessage(m.id, fwTo, fwNote); if (!r.ok) setError(r.error); else router.push(`${base}/${r.threadId}`); })} className="rounded-full bg-[#233c5e] px-4 py-1.5 font-semibold text-white disabled:opacity-50">
                            Inoltra con gli allegati
                          </button>
                          <button type="button" onClick={() => setForwarding(null)} className="px-2 text-slate-600">Annulla</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            )}
          </Fragment>
        ))}
      </div>

    </div>
  );
}
