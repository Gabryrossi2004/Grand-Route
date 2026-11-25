import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { handleReport } from "@/lib/actions/admin";

type R = {
  id: string; reason: string; note: string | null; created_at: string; handled: boolean; group_name: string | null;
  post_id: string | null; comment_id: string | null; content: string | null; author_name: string | null; reporter_name: string | null;
};
const REASONS: Record<string, string> = { offensivo: "Offensivo", spam: "Spam", dati_personali: "Dati personali", falso: "Falso", altro: "Altro" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = "aperte" } = await searchParams;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();
  const { data, error } = await supabase.rpc("admin_reports", { p_handled: s === "gestite" });
  const rows = (data ?? []) as R[];

  return (
    <div>
      <Link href="/dashboard/admin" className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Amministrazione
      </Link>
      <h1 className="mb-4 text-3xl font-medium text-[#233c5e]">Segnalazioni della Community</h1>
      <div className="mb-5 flex gap-2">
        {[["aperte", "Da gestire"], ["gestite", "Gestite"]].map(([k, l]) => (
          <Link key={k} href={`/dashboard/admin/segnalazioni?s=${k}`} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${s === k ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e]"}`}>
            {l}
          </Link>
        ))}
      </div>
      {error && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Serve l&apos;aggiornamento del database 0062.</p>}
      {!error && rows.length === 0 && <p className="text-slate-500">Nessuna segnalazione in questa lista.</p>}
      <div className="grid gap-3">
        {rows.map((r) => (
          <article key={r.id} className="rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">
              <strong className="text-[#233c5e]">{REASONS[r.reason] ?? r.reason}</strong> · segnalato da {r.reporter_name ?? "—"} · gruppo {r.group_name ?? "—"} ·{" "}
              {new Date(r.created_at).toLocaleDateString("it-IT")}
            </p>
            <p className="mt-2 text-sm text-slate-600">Autore: {r.author_name ?? "—"} ({r.comment_id ? "commento" : "post"})</p>
            <p className="mt-1 whitespace-pre-line rounded-xl bg-[#faf3e6] p-3 text-sm text-slate-800">{r.content ?? "(contenuto già rimosso)"}</p>
            {r.note && <p className="mt-2 text-sm italic text-slate-600">Nota di chi ha segnalato: {r.note}</p>}
            <form action={handleReport} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="report_id" value={r.id} />
              {r.handled ? (
                <button name="action" value="riapri" className="rounded-full border border-[#e6d7bb] px-4 py-2 text-sm font-semibold text-[#233c5e]">Riapri</button>
              ) : (
                <>
                  <button name="action" value="gestita" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Segna come gestita</button>
                  {r.content && <button name="action" value="rimuovi" className="rounded-full bg-[#b0413e] px-4 py-2 text-sm font-semibold text-white">Rimuovi il contenuto</button>}
                </>
              )}
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
