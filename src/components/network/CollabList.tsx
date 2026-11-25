"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Handshake, Mail, Phone } from "lucide-react";
import { endCollaboration, respondCollaboration } from "@/lib/actions/network";
import { kindLabel } from "@/lib/network/kinds";

export type CollabRow = {
  id: string; direction: "ricevuta" | "inviata"; status: string; other_user: string; other_name: string; other_kind: string;
  message: string | null; created_at: string; responded_at: string | null; other_email: string | null; other_phone: string | null;
};

const LABEL: Record<string, string> = { in_attesa: "In attesa", accettata: "Partner", rifiutata: "Rifiutata", annullata: "Annullata", terminata: "Terminata" };

// Richieste di collaborazione: si accettano o si rifiutano da qui; i partner restano in elenco con i loro recapiti
export default function CollabList({ rows }: { rows: CollabRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Errore");
    });
  const fmt = (d: string) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  if (rows.length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-[#233c5e]"><Handshake size={20} /> Collaborazioni</h2>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 grid gap-3">
        {rows.map((r) => (
          <article key={r.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${r.status === "in_attesa" && r.direction === "ricevuta" ? "border-[#c58f2d]" : "border-[#e6d7bb]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold text-[#233c5e]">
                <Link href={`/rete/${r.other_user}`} className="hover:underline">{r.other_name}</Link>{" "}
                <span className="text-xs font-normal text-slate-500">{kindLabel(r.other_kind)}</span>
              </p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === "accettata" ? "bg-emerald-100 text-emerald-800" : r.status === "in_attesa" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                {r.status === "in_attesa" ? (r.direction === "ricevuta" ? "Ti propone di collaborare" : "In attesa di risposta") : LABEL[r.status] ?? r.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{fmt(r.created_at)}</p>
            {r.message && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.message}</p>}
            {r.status === "accettata" && (
              <p className="mt-3 flex flex-wrap gap-4 text-sm">
                {r.other_email && <a href={`mailto:${r.other_email}`} className="flex items-center gap-1.5 font-medium text-[#233c5e] hover:underline"><Mail size={15} /> {r.other_email}</a>}
                {r.other_phone && <a href={`tel:${r.other_phone}`} className="flex items-center gap-1.5 font-medium text-[#233c5e] hover:underline"><Phone size={15} /> {r.other_phone}</a>}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === "in_attesa" && r.direction === "ricevuta" && (
                <>
                  <button type="button" disabled={pending} onClick={() => run(() => respondCollaboration(r.id, true))} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Accetta e salva i dati in rubrica</button>
                  <button type="button" disabled={pending} onClick={() => run(() => respondCollaboration(r.id, false))} className="rounded-full border border-[#e6d7bb] px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Rifiuta</button>
                </>
              )}
              {r.status === "in_attesa" && r.direction === "inviata" && (
                <button type="button" disabled={pending} onClick={() => run(() => endCollaboration(r.id))} className="text-xs font-medium text-slate-500 underline">Annulla la richiesta</button>
              )}
              {r.status === "accettata" && (
                <button type="button" disabled={pending} onClick={() => run(() => endCollaboration(r.id))} className="text-xs font-medium text-slate-500 underline">Termina la collaborazione</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
