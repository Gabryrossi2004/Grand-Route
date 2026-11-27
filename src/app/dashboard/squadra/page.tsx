import Link from "next/link";
import { ArrowLeft, Crown } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import { ROLE_LABELS, isTeamRole, type TeamRole } from "@/lib/teamRoles";
import { buildTeamInviteLink } from "@/lib/teamInvite";
import TeamComingSoon, { ONLY_TITOLARE_TEXT } from "@/components/TeamComingSoon";
import TeamInviteForm from "@/components/team/TeamInviteForm";
import MemberControls from "@/components/team/MemberControls";
import RevokeInviteButton from "@/components/team/RevokeInviteButton";
import CopyLinkButton from "@/components/team/CopyLinkButton";
import AccountModeCard from "@/components/team/AccountModeCard";

export const metadata = { title: "Squadra" };

type Person = { id: string; full_name: string | null; email: string | null };
type Invite = { id: string; email: string; role: string; token: string; created_at: string; expires_at: string };

const dayIt = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

// Squadra dell'agenzia: colleghi, ruoli, inviti. Solo per i titolari di un account aziendale.
export default async function TeamPage() {
  const team = await getTeamContext();
  if (!team) redirect("/professionisti?next=/dashboard/squadra");
  if (!team.isTitolare) return <TeamComingSoon title="Riservato al titolare" text={ONLY_TITOLARE_TEXT} />;

  const header = (
    <div>
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-[#233c5e]">
        <ArrowLeft size={15} aria-hidden /> Impostazioni
      </Link>
      <p className="eyebrow mt-3">Account aziendale</p>
      <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#233c5e] sm:text-4xl">Squadra</h1>
      <p className="mt-2 text-sm text-slate-600">
        Tutti i colleghi vedono e modificano i viaggi, i clienti, i fornitori e i pagamenti dell&apos;agenzia. I titolari gestiscono anche la squadra, le
        impostazioni e il piano.
      </p>
    </div>
  );

  if (team.accountMode !== "azienda") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {header}
        <AccountModeCard mode="individuale" compact />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: memberRows, error: membersError }, { data: inviteRows }] = await Promise.all([
    supabase.from("team_members").select("user_id, role, created_at").eq("company_id", team.companyId).order("created_at"),
    supabase
      .from("team_invites")
      .select("id, email, role, token, created_at, expires_at")
      .eq("company_id", team.companyId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  const members = ((memberRows as { user_id: string; role: string; created_at: string }[] | null) ?? []).filter((m) => isTeamRole(m.role));
  const ids = [team.companyId, ...members.map((m) => m.user_id)];
  const { data: people } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  const byId = new Map(((people as Person[] | null) ?? []).map((p) => [p.id, p]));
  const founder = byId.get(team.companyId);
  const invites = (inviteRows as Invite[] | null) ?? [];
  const inviteLinks = await Promise.all(invites.map((i) => buildTeamInviteLink(i.token)));
  const nameOf = (id: string) => byId.get(id)?.full_name || byId.get(id)?.email || "Collega";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {header}

      {membersError && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Per la squadra serve l&apos;aggiornamento del database (migrazione 0075, in Supabase → SQL Editor).
        </p>
      )}

      <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5 shadow-sm">
        <h2 className="mb-3 border-b border-[#e6d7bb] pb-3 text-xl font-medium text-[#233c5e]">Chi fa parte della squadra</h2>
        <ul className="flex flex-col divide-y divide-[#f1e6cf]">
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {founder?.full_name || founder?.email || "Fondatore"} {team.companyId === team.userId && <span className="font-normal text-slate-500">(tu)</span>}
              </span>
              <span className="block truncate text-xs text-slate-500">{founder?.email}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#faf3e6] px-3 py-1 text-xs font-semibold text-[#c58f2d]">
              <Crown size={13} aria-hidden /> Titolare · ha aperto l&apos;account
            </span>
          </li>
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {nameOf(m.user_id)} {m.user_id === team.userId && <span className="font-normal text-slate-500">(tu)</span>}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {byId.get(m.user_id)?.email} · nella squadra dal {dayIt(m.created_at)}
                </span>
              </span>
              <MemberControls userId={m.user_id} role={m.role as TeamRole} name={nameOf(m.user_id)} isSelf={m.user_id === team.userId} />
            </li>
          ))}
        </ul>
        {members.length === 0 && <p className="mt-2 text-sm text-slate-500">Ancora nessun collega: invitalo qui sotto.</p>}
      </section>

      <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5 shadow-sm">
        <h2 className="mb-3 border-b border-[#e6d7bb] pb-3 text-xl font-medium text-[#233c5e]">Invita un collega</h2>
        <TeamInviteForm />
      </section>

      {invites.length > 0 && (
        <section className="rounded-2xl border border-[#e6d7bb] bg-[#faf3e6]/60 p-5">
          <h2 className="mb-3 text-lg font-medium text-[#233c5e]">Inviti in attesa</h2>
          <ul className="flex flex-col gap-3">
            {invites.map((i, k) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{i.email}</span>
                  <span className="block text-xs text-slate-500">
                    {isTeamRole(i.role) ? ROLE_LABELS[i.role] : i.role} · scade il {dayIt(i.expires_at)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <CopyLinkButton link={inviteLinks[k]} />
                  <RevokeInviteButton id={i.id} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
