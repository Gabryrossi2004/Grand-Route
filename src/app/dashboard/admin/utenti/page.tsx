import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_KINDS, KIND_INFO, kindLabel } from "@/lib/network/kinds";
import { setUserSuspended } from "@/lib/actions/admin";

type U = {
  id: string; email: string; full_name: string | null; agency_name: string | null; kind: string; created_at: string;
  last_sign_in_at: string | null; suspended_at: string | null; suspended_reason: string | null; is_admin: boolean;
};

const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "mai");

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string }> }) {
  const { q = "", tipo = "" } = await searchParams;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();
  const { data, error } = await supabase.rpc("admin_users", { p_query: q.trim() || null, p_kind: tipo || null, p_limit: 100, p_offset: 0 });
  const rows = (data ?? []) as U[];
  const label = (k: string) => (k === "cliente" ? "Cliente di un'agenzia" : k === "viaggiatore" ? "Viaggiatore privato" : kindLabel(k));

  return (
    <div>
      <Link href="/dashboard/admin" className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Amministrazione
      </Link>
      <h1 className="mb-4 text-3xl font-medium text-[#233c5e]">Utenti</h1>
      <form className="mb-5 grid gap-2 sm:grid-cols-[1.5fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Nome, email o agenzia" className={input} />
        <select name="tipo" defaultValue={tipo} className={input} aria-label="Tipo">
          <option value="">Tutti</option>
          {BUSINESS_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_INFO[k].label}</option>
          ))}
          <option value="cliente">Clienti delle agenzie</option>
          <option value="viaggiatore">Viaggiatori privati</option>
        </select>
        <button className="rounded-lg bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white">Cerca</button>
      </form>
      {error && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Serve l&apos;aggiornamento del database 0062.</p>}
      <div className="grid gap-3">
        {rows.map((u) => (
          <article key={u.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${u.suspended_at ? "border-[#b0413e]/50" : "border-[#e6d7bb]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[#233c5e]">
                  {u.agency_name || u.full_name || u.email}
                  {u.is_admin && <span className="ml-2 rounded-full bg-[#233c5e] px-2 py-0.5 text-xs font-medium text-white">Amministratore</span>}
                  {u.suspended_at && <span className="ml-2 rounded-full bg-[#b0413e] px-2 py-0.5 text-xs font-medium text-white">Sospeso</span>}
                </p>
                <p className="truncate text-sm text-slate-600">{u.email}</p>
              </div>
              <p className="text-right text-xs text-slate-500">
                {label(u.kind)}
                <br />
                Iscritto il {fmt(u.created_at)} · ultimo accesso {fmt(u.last_sign_in_at)}
              </p>
            </div>
            {!u.is_admin && (
              <form action={setUserSuspended} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="user_id" value={u.id} />
                {u.suspended_at ? (
                  <>
                    <p className="flex-1 text-sm text-slate-600">Motivo: {u.suspended_reason ?? "—"}</p>
                    <input type="hidden" name="reason" value="" />
                    <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Riattiva</button>
                  </>
                ) : (
                  <>
                    <input name="reason" placeholder="Motivo della sospensione" required maxLength={300} className={`${input} min-w-[220px] flex-1`} />
                    <button className="rounded-full bg-[#b0413e] px-4 py-2 text-sm font-semibold text-white">Sospendi</button>
                  </>
                )}
              </form>
            )}
          </article>
        ))}
        {!error && rows.length === 0 && <p className="text-slate-500">Nessun utente trovato.</p>}
      </div>
    </div>
  );
}
