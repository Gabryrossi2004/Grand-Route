"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { discardMessage, draftReplyWithZefiro, finishMessage, startMessage } from "@/lib/actions/mail";
import { MAX_FILES, MAX_FILE_BYTES, fileSize, safeFileName } from "@/lib/mail/shared";
import type { OrderPartner } from "@/lib/orders/shared";
import { kindLabel } from "@/lib/network/kinds";

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";

// Scrivere: risposta in una conversazione oppure nuovo messaggio (destinatari, oggetto, testo, allegati)
export default function Composer({
  threadId = null,
  partners = [],
  base,
  initialTo = [],
  initialSubject = "",
  initialBody = "",
  compact = false,
}: {
  threadId?: string | null;
  partners?: OrderPartner[];
  base: string;
  initialTo?: string[];
  initialSubject?: string;
  initialBody?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [to, setTo] = useState<string[]>(initialTo);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [hint, setHint] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isNew = !threadId;

  const addFiles = (list: FileList | File[]) => {
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`«${f.name}» supera i 25 MB.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        setError(`Al massimo ${MAX_FILES} allegati per messaggio.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const send = () =>
    start(async () => {
      setError(null);
      if (isNew && to.length === 0) return setError("Scegli almeno un destinatario.");
      if (!body.trim() && files.length === 0) return setError("Scrivi un messaggio o allega un file.");
      const started = await startMessage(threadId, subject || "(senza oggetto)", to, body);
      if (!started.ok) return setError(started.error);
      const uploaded: { path: string; name: string; size: number; mime: string }[] = [];
      const supabase = createClient();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(`Carico ${f.name} (${i + 1} di ${files.length})…`);
        const path = `${started.threadId}/${started.messageId}/${Date.now().toString(36)}-${safeFileName(f.name)}`;
        const up = await supabase.storage.from("mail-files").upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
        if (up.error) {
          setProgress(null);
          await discardMessage(started.messageId);
          return setError(`Non sono riuscito a caricare «${f.name}». Controlla la connessione e riprova.`);
        }
        uploaded.push({ path, name: f.name, size: f.size, mime: f.type });
      }
      setProgress(null);
      const done = await finishMessage(started.messageId, uploaded);
      if (!done.ok) return setError(done.error);
      setBody("");
      setFiles([]);
      if (isNew) router.push(`${base}/${done.threadId}`);
      else router.refresh();
    });

  const suggest = () =>
    start(async () => {
      if (!threadId) return;
      setError(null);
      const r = await draftReplyWithZefiro(threadId, hint);
      if (!r.ok) return setError(r.error);
      setBody(r.text);
      setAiOpen(false);
    });

  const filtered = partners.filter((p) => !to.includes(p.user_id) && p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      className="rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
    >
      {isNew && (
        <div className="mb-3 space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">A</p>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5">
              {to.map((id) => {
                const p = partners.find((x) => x.user_id === id);
                return (
                  <span key={id} className="flex items-center gap-1 rounded-full bg-[#233c5e] py-1 pl-3 pr-1 text-xs font-medium text-white">
                    {p?.name ?? "Partner"}
                    <button type="button" onClick={() => setTo(to.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-white/20" aria-label="Togli"><X size={12} /></button>
                  </span>
                );
              })}
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={to.length ? "Aggiungi…" : "Cerca un partner…"} className="min-w-32 flex-1 px-1 py-1 text-sm outline-none" aria-label="Destinatari" />
            </div>
            {search && (
              <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-[#e6d7bb] bg-white text-sm shadow">
                {filtered.slice(0, 8).map((p) => (
                  <li key={p.user_id}>
                    <button type="button" onClick={() => { setTo([...to, p.user_id]); setSearch(""); }} className="block w-full px-3 py-2 text-left hover:bg-[#faf3e6]">
                      {p.name} <span className="text-xs text-slate-500">· {kindLabel(p.kind)}</span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="px-3 py-2 text-slate-500">Nessun partner con questo nome.</li>}
              </ul>
            )}
            {!search && partners.length > 0 && to.length === 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {partners.slice(0, 6).map((p) => (
                  <button key={p.user_id} type="button" onClick={() => setTo([...to, p.user_id])} className="rounded-full border border-[#e6d7bb] px-2.5 py-1 text-xs text-[#233c5e] hover:border-[#c58f2d]">+ {p.name}</button>
                ))}
              </div>
            )}
            {partners.length === 0 && <p className="mt-1 text-xs text-amber-700">Non hai ancora partner: la posta si usa con chi ha accettato una collaborazione nella Rete.</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="mail-subject">Oggetto</label>
            <input id="mail-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={input} />
          </div>
        </div>
      )}
      <label className="sr-only" htmlFor="mail-body">Messaggio</label>
      <textarea
        id="mail-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 4 : 10}
        maxLength={50000}
        placeholder={isNew ? "Scrivi il messaggio…" : "Scrivi la risposta…"}
        className={`${input} resize-y leading-relaxed`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
      />
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-lg border border-[#e6d7bb] bg-[#faf3e6] py-1 pl-2.5 pr-1 text-xs text-slate-700">
              <Paperclip size={12} /> <span className="max-w-[12rem] truncate">{f.name}</span> <span className="text-slate-400">{fileSize(f.size)}</span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-0.5 hover:bg-white" aria-label={`Togli ${f.name}`}><X size={12} /></button>
            </li>
          ))}
        </ul>
      )}
      {aiOpen && threadId && (
        <div className="mt-2 flex flex-wrap gap-2 rounded-xl bg-[#faf3e6] p-2">
          <input value={hint} onChange={(e) => setHint(e.target.value)} maxLength={500} placeholder="Cosa vuoi rispondere? (es. confermiamo, chiedi l'orario del volo)" className={`${input} flex-1`} />
          <button type="button" disabled={pending} onClick={suggest} className="rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Scrivi la bozza</button>
        </div>
      )}
      {progress && <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Loader2 size={14} className="animate-spin" /> {progress}</p>}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={send} className="inline-flex items-center gap-2 rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Invia
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-[#e6d7bb] px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#c58f2d]">
          <Paperclip size={15} /> Allega
        </button>
        <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        {threadId && (
          <button type="button" onClick={() => setAiOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-[#8a5a12] hover:bg-[#faf3e6]">
            <Sparkles size={15} /> Zefiro, aiutami a rispondere
          </button>
        )}
        <span className="ml-auto hidden text-xs text-slate-400 sm:inline">Puoi trascinare qui i file · Ctrl+Invio per inviare</span>
      </div>
    </div>
  );
}
