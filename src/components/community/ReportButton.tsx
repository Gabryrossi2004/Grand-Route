"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { reportContent } from "@/app/dashboard/community/actions";

const REASONS = [
  { value: "offensivo", label: "Toni offensivi o scorretti" },
  { value: "spam", label: "Pubblicità o spam" },
  { value: "dati_personali", label: "Dati personali di clienti" },
  { value: "falso", label: "Informazioni false o ingannevoli" },
  { value: "altro", label: "Altro" },
];

export default function ReportButton({ groupId, postId, commentId }: { groupId: string; postId?: string; commentId?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("offensivo");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (message) return <span className="text-xs text-slate-500">{message}</span>;

  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500" aria-label="Segnala">
        <Flag size={12} /> Segnala
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-[#e6d7bb] bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-slate-800">Perché lo segnali?</p>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Note (facoltative)" className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500">
              Annulla
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await reportContent(groupId, { postId, commentId }, reason, note);
                  setMessage("error" in r && r.error ? r.error : "Segnalazione inviata al responsabile del gruppo.");
                  setOpen(false);
                })
              }
              className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
            >
              Invia
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
