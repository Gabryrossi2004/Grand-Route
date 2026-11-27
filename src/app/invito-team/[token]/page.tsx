import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { ACCEPT_MESSAGES } from "@/lib/teamInvite";
import { ROLE_LABELS, isTeamRole } from "@/lib/teamRoles";
import { JoinAsCurrentUser, JoinSignupForm } from "./JoinTeamForms";

export const metadata = { title: "Invito nel team" };

type InviteInfo = { agency: string; email: string; role: string; state: string } | null;

// Pagina del link d'invito: chi è stato invitato crea qui il suo account (o entra con quello che ha)
export default async function TeamInvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ esito?: string }> }) {
  const { token } = await params;
  const { esito } = await searchParams;
  const supabase = await createClient();
  const [{ data }, user] = await Promise.all([supabase.rpc("team_invite_info", { p_token: token }), getCachedUser()]);
  const info = (data as InviteInfo) ?? null;
  const role = info && isTeamRole(info.role) ? ROLE_LABELS[info.role] : null;

  const message = (text: string) => (
    <p className="rounded-xl border border-[#e6d7bb] bg-[#faf3e6] px-4 py-3 text-sm text-[#6b5f4a]">{text}</p>
  );

  let body: React.ReactNode;
  if (esito && ACCEPT_MESSAGES[esito]) {
    body = message(ACCEPT_MESSAGES[esito]);
  } else if (!info) {
    body = message(ACCEPT_MESSAGES.non_trovato);
  } else if (info.state !== "valido") {
    body = message(ACCEPT_MESSAGES[info.state === "usato" ? "usato" : info.state === "scaduto" ? "scaduto" : "revocato"]);
  } else if (user) {
    const sameEmail = (user.email ?? "").toLowerCase() === info.email.toLowerCase();
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          Sei collegato come <strong>{user.email}</strong>.
        </p>
        {sameEmail ? <JoinAsCurrentUser token={token} /> : message(ACCEPT_MESSAGES.email)}
        <form action={signOut}>
          <button type="submit" className="text-xs font-medium text-[#233c5e] hover:underline">
            Non sei tu? Esci
          </button>
        </form>
      </div>
    );
  } else {
    body = <JoinSignupForm token={token} email={info.email} />;
  }

  return (
    <AuthShell>
      <AuthBrandHeader />
      <h1 className="mb-1 text-xl font-semibold text-slate-900">{info ? `${info.agency} ti invita nel team` : "Invito nel team"}</h1>
      {info && role && (
        <p className="mb-5 text-sm text-slate-500">
          Ruolo: <strong className="text-[#233c5e]">{role}</strong>. Vedrai e potrai lavorare su viaggi, clienti, fornitori e pagamenti dell&apos;agenzia.
        </p>
      )}
      {body}
      <p className="mt-6 text-center text-sm text-slate-500">
        Hai già un account?{" "}
        <Link href="/professionisti" className="font-medium text-[#233c5e] hover:underline">
          Accedi
        </Link>
      </p>
    </AuthShell>
  );
}
