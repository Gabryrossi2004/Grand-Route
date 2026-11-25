"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Sparkles, X } from "lucide-react";
import { askZefiroMail } from "@/lib/actions/mail";
import type { MailAskResult } from "@/lib/mailAi";

// Zefiro (facoltativo): scrivi cosa cerchi nella posta, lui legge i messaggi trovati e risponde con i link
export default function ZefiroMailPanel({ base }: { base: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ result: MailAskResult; threads: Record<string, { thread_id: string; subject: string }> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[#c58f2d] px-4 py-2 text-sm font-semibold text-[#8a5a12] hover:bg-[#faf3e6]">
        <Sparkles size={15} /> Chiedi a Zefiro
      </button>
    );
  return (
    <div className="w-full rounded-2xl border border-[#c58f2d] bg-[#fffaf0] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#8a5a12]"><Sparkles size={15} /> Zefiro cerca nella tua posta</p>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400" aria-label="Chiudi"><X size={16} /></button>
      </div>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const r = await askZefiroMail(q);
            if (r.ok) setRes({ result: r.result, threads: r.threads });
            else setError(r.error);
          });
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="Es. quanto abbiamo concordato con Best NCC per il transfer Deluca?" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]" />
        <button disabled={pending || q.trim().length < 3} className="inline-flex items-center gap-2 rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending && <Loader2 size={14} className="animate-spin" />} Chiedi
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {res && (
        <div className="mt-3 text-sm text-slate-700">
          <p className="whitespace-pre-line">{res.result.answer}</p>
          {res.result.threads.length > 0 && (
            <ul className="mt-2 space-y-1">
              {res.result.threads.map((t) => {
                const th = res.threads[t.ref];
                return th ? (
                  <li key={t.ref}>
                    <Link href={`${base}/${th.thread_id}`} className="font-medium text-[#233c5e] underline">{th.subject}</Link> <span className="text-slate-500">· {t.why}</span>
                  </li>
                ) : null;
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-400">Zefiro legge solo la tua posta e può sbagliare: apri il messaggio per controllare.</p>
        </div>
      )}
    </div>
  );
}
