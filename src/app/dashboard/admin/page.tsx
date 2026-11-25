import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Flag, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { KIND_INFO, BUSINESS_KINDS } from "@/lib/network/kinds";
import { createDemoData, removeDemoData } from "@/lib/actions/admin";

type Overview = Record<string, number>;

function Card({ href, icon, title, text, badge }: { href: string; icon: React.ReactNode; title: string; text: string; badge?: number }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#233c5e] text-white">{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
          {title}
          {!!badge && <span className="rounded-full bg-[#c0392b] px-2 py-0.5 text-xs font-semibold text-white">{badge}</span>}
        </span>
        <span className="block text-sm text-slate-600">{text}</span>
      </span>
    </Link>
  );
}

// Amministrazione: panoramica e porta d'ingresso per verificare, moderare e sospendere. Solo per gli amministratori.
export default async function AdminHome() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();
  const { data } = await supabase.rpc("admin_overview");
  const ov = (data ?? null) as Overview | null;
  const { data: demoData, error: demoError } = await supabase.rpc("admin_demo_count");
  const demo = typeof demoData === "number" ? demoData : 0;
  const { count: pending } = await supabase.from("network_profiles").select("user_id", { count: "exact", head: true }).eq("status", "in_verifica");

  return (
    <div>
      <h1 className="mb-1 text-3xl font-medium text-[#233c5e]">Amministrazione</h1>
      <p className="mb-6 text-base text-slate-600">Da qui controlli chi si iscrive, verifichi i profili della Rete e gestisci le segnalazioni.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card href="/dashboard/admin/rete" icon={<BadgeCheck size={20} />} title="Rete: verifica dei profili" text="Controlla partita IVA, licenze e assicurazioni, poi approva." badge={pending ?? 0} />
        <Card href="/dashboard/admin/utenti" icon={<Users size={20} />} title="Utenti" text="Elenco di tutti gli account, ricerca e sospensione." />
        <Card href="/dashboard/admin/segnalazioni" icon={<Flag size={20} />} title="Segnalazioni della Community" text="Post e commenti segnalati: gestisci o rimuovi." badge={ov?.segnalazioni_aperte ?? 0} />
        <Card href="/dashboard/admin/ai-rules" icon={<Sparkles size={20} />} title={`Regole di ${ASSISTANT_NAME}`} text="Le regole di base dell'assistente per tutte le agenzie." />
      </div>

      <h2 className="mb-3 mt-10 text-xl font-medium text-[#233c5e]">Chi c&apos;è sul sito</h2>
      {!ov ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per vedere i numeri serve l&apos;aggiornamento del database 0062 (Supabase → SQL Editor).</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BUSINESS_KINDS.map((k) => (
              <div key={k} className="rounded-xl border border-[#e6d7bb] bg-white p-4">
                <p className="text-2xl font-semibold text-[#233c5e]">{ov[k] ?? 0}</p>
                <p className="text-xs text-slate-600">{KIND_INFO[k].label}</p>
              </div>
            ))}
            <div className="rounded-xl border border-[#e6d7bb] bg-white p-4">
              <p className="text-2xl font-semibold text-[#233c5e]">{ov.clienti ?? 0}</p>
              <p className="text-xs text-slate-600">Clienti delle agenzie</p>
            </div>
            <div className="rounded-xl border border-[#e6d7bb] bg-white p-4">
              <p className="text-2xl font-semibold text-[#233c5e]">{ov.viaggiatori ?? 0}</p>
              <p className="text-xs text-slate-600">Viaggiatori privati</p>
            </div>
            <div className="rounded-xl border border-[#e6d7bb] bg-white p-4">
              <p className="text-2xl font-semibold text-[#233c5e]">{ov.nuovi_7_giorni ?? 0}</p>
              <p className="text-xs text-slate-600">Nuovi negli ultimi 7 giorni</p>
            </div>
            <div className="rounded-xl border border-[#e6d7bb] bg-white p-4">
              <p className="text-2xl font-semibold text-[#b0413e]">{ov.sospesi ?? 0}</p>
              <p className="text-xs text-slate-600">Account sospesi</p>
            </div>
          </div>
        </>
      )}

      <h2 className="mb-2 mt-10 text-xl font-medium text-[#233c5e]">Profili di prova</h2>
      <p className="mb-3 text-sm text-slate-600">
        Per vedere come sarà il sito pieno: crea 14 profili fittizi (guide, autisti, strutture, esperienze, agenzie locali, tour operator e un&apos;agenzia) già verificati, con valutazioni e due messaggi per te in Rete. Non si può accedere con questi account. Tutti i profili di prova sono visibili agli utenti della Rete finché non li togli.
      </p>
      {demoError ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Serve l&apos;aggiornamento del database 0063 (Supabase → SQL Editor).</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <p className="mr-auto text-sm text-slate-700">
            {demo > 0 ? <strong className="text-[#b0413e]">{demo} profili di prova attivi</strong> : "Nessun profilo di prova attivo."}
          </p>
          <form action={createDemoData}>
            <button className="rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white">{demo > 0 ? "Ricrea i profili di prova" : "Crea i profili di prova"}</button>
          </form>
          {demo > 0 && (
            <form action={removeDemoData}>
              <button className="rounded-full bg-[#b0413e] px-4 py-2 text-sm font-semibold text-white">Rimuovi tutti i profili di prova</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
