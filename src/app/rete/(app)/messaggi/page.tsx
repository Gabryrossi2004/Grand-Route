import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { kindLabel } from "@/lib/network/kinds";
import CollabList, { type CollabRow } from "@/components/network/CollabList";

type Row = {
  id: string; direction: "ricevuta" | "inviata"; other_user: string; other_name: string; other_kind: string;
  other_email: string | null; other_phone: string | null; message: string; created_at: string; read_at: string | null;
};

// Richieste ricevute (con i recapiti di chi ha scritto) e inviate
export default async function NetworkMessages() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_inbox");
  const rows = (data ?? []) as Row[];
  const { data: collabData } = await supabase.rpc("network_collab_list");
  const collabs = ((collabData ?? []) as CollabRow[]).filter((c) => c.status !== "annullata");
  if (!error && rows.some((r) => r.direction === "ricevuta" && !r.read_at)) await supabase.rpc("network_mark_all_read");
  const fmt = (d: string) => new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <p className="eyebrow">Rete professionale</p>
      <h1 className="mt-1 text-3xl text-[#233c5e]">Richieste e collaborazioni</h1>
      <p className="mt-2 text-base text-slate-600">Chi ti scrive lascia i suoi recapiti: rispondi direttamente per email o telefono.</p>
      <CollabList rows={collabs} />
      {rows.length > 0 && <h2 className="mt-8 text-xl font-semibold text-[#233c5e]">Richieste di contatto</h2>}
      {error ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per attivare la Rete serve l&apos;aggiornamento del database (migrazione 0061).</p>
      ) : rows.length === 0 ? (
        collabs.length > 0 ? null : <div className="mt-6 rounded-2xl border border-dashed border-[#e6d7bb] bg-white/60 p-8 text-center text-slate-600">
          Nessuna richiesta per ora. <Link href="/rete" className="font-semibold text-[#233c5e] underline">Cerca un professionista</Link> per scrivere per primo.
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {rows.map((r) => (
            <article key={`${r.direction}-${r.id}`} className={`rounded-2xl border bg-white p-4 shadow-sm ${r.direction === "ricevuta" && !r.read_at ? "border-[#c58f2d]" : "border-[#e6d7bb]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-base font-semibold text-[#233c5e]">
                  {r.direction === "ricevuta" ? <ArrowDownLeft size={16} className="text-emerald-600" /> : <ArrowUpRight size={16} className="text-slate-400" />}
                  {r.direction === "ricevuta" ? "Da " : "A "}
                  <Link href={`/rete/${r.other_user}`} className="hover:underline">{r.other_name}</Link>
                  <span className="text-xs font-normal text-slate-500">{kindLabel(r.other_kind)}</span>
                </p>
                <span className="text-xs text-slate-500">{fmt(r.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.message}</p>
              {r.direction === "ricevuta" && (
                <p className="mt-3 flex flex-wrap gap-4 text-sm">
                  {r.other_email && <a href={`mailto:${r.other_email}`} className="flex items-center gap-1.5 font-medium text-[#233c5e] hover:underline"><Mail size={15} /> {r.other_email}</a>}
                  {r.other_phone && <a href={`tel:${r.other_phone}`} className="flex items-center gap-1.5 font-medium text-[#233c5e] hover:underline"><Phone size={15} /> {r.other_phone}</a>}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
