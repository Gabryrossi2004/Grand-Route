"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NOT_TITOLARE, getTeamContext, type TeamContext } from "@/lib/team";
import { isTeamRole } from "@/lib/teamRoles";
import { buildTeamInviteEmail, buildTeamInviteLink } from "@/lib/teamInvite";
import { sendMail } from "@/lib/email";

export type InviteState = { error?: string; link?: string; email?: string; emailSent?: boolean } | undefined;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// per i confronti con ilike (senza caratteri jolly)
const likeExact = (v: string) => v.replace(/[%_\\]/g, "\\$&");

// Messaggi per gli esiti delle funzioni della squadra (migrazione 0075)
const RESULT_TEXT: Record<string, string> = {
  non_autorizzato: NOT_TITOLARE,
  ruolo: "Ruolo non valido.",
  fondatore: "Chi ha aperto l'account dell'agenzia resta sempre titolare e non si può togliere.",
  non_trovato: "Questa persona non fa parte della squadra.",
  ultimo_titolare: "Deve restare almeno un titolare.",
  ha_squadra: "Prima togli i colleghi dalla squadra, poi puoi tornare all'account individuale.",
  non_professionista: "Per ora l'account aziendale è per agenzie, tour operator e DMC.",
  modo: "Scelta non valida.",
};

async function titolare(): Promise<{ error: string } | { team: TeamContext }> {
  const team = await getTeamContext();
  if (!team) return { error: "Sessione scaduta: accedi di nuovo." };
  if (!team.isTitolare) return { error: NOT_TITOLARE };
  return { team };
}

// Invita un collega per email: crea l'invito, manda l'email (se il servizio è configurato) e restituisce il link da copiare
export async function inviteMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const check = await titolare();
  if ("error" in check) return { error: check.error };
  const { team } = check;
  if (team.accountMode !== "azienda") return { error: "Per invitare dei colleghi trasforma prima l'account in aziendale." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "Scrivi un'email valida." };
  if (!isTeamRole(role)) return { error: "Scegli un ruolo." };

  const supabase = await createClient();
  // chi è già nella squadra non va invitato di nuovo
  const { data: members } = await supabase.from("team_members").select("user_id").eq("company_id", team.companyId);
  const ids = [team.companyId, ...((members as { user_id: string }[] | null) ?? []).map((m) => m.user_id)];
  const { data: already } = await supabase.from("profiles").select("id").in("id", ids).ilike("email", likeExact(email)).limit(1);
  if (already && already.length > 0) return { error: "Questa persona fa già parte della squadra." };

  // un solo invito valido per email: i precedenti ancora aperti si annullano
  await supabase
    .from("team_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("company_id", team.companyId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const { data: invite, error } = await supabase
    .from("team_invites")
    .insert({ company_id: team.companyId, email, role, invited_by: team.userId })
    .select("token")
    .single();
  if (error || !invite) {
    console.error("[squadra] invito non creato:", error?.message);
    return { error: /team_invites|relation|does not exist/i.test(error?.message ?? "") ? "Serve l'aggiornamento del database (migrazione 0075)." : "Invito non creato. Riprova." };
  }

  const link = await buildTeamInviteLink((invite as { token: string }).token);
  const [{ data: company }, { data: me }] = await Promise.all([
    supabase.from("profiles").select("agency_name, full_name, email").eq("id", team.companyId).maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", team.userId).maybeSingle(),
  ]);
  const c = (company as { agency_name?: string | null; full_name?: string | null; email?: string | null } | null) ?? {};
  const m = (me as { full_name?: string | null; email?: string | null } | null) ?? {};
  const agencyName = c.agency_name || c.full_name || "La tua agenzia";
  const mail = buildTeamInviteEmail({ agencyName, inviterName: m.full_name ?? "", role, link });
  const sent = await sendMail({ to: email, ...mail, replyTo: m.email || c.email || null, fromName: agencyName });

  revalidatePath("/dashboard/squadra");
  return { link, email, emailSent: sent.ok };
}

export async function revokeInvite(id: string): Promise<{ ok: true } | { error: string }> {
  const check = await titolare();
  if ("error" in check) return { error: check.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", check.team.companyId);
  if (error) return { error: "Invito non annullato. Riprova." };
  revalidatePath("/dashboard/squadra");
  return { ok: true };
}

export async function changeMemberRole(userId: string, role: string): Promise<{ ok: true } | { error: string }> {
  const check = await titolare();
  if ("error" in check) return { error: check.error };
  if (!isTeamRole(role)) return { error: "Ruolo non valido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("team_set_role", { p_user: userId, p_role: role });
  if (error) return { error: "Ruolo non cambiato. Riprova." };
  if (data !== "ok") return { error: RESULT_TEXT[String(data)] ?? "Ruolo non cambiato." };
  revalidatePath("/dashboard/squadra");
  return { ok: true };
}

// Toglie un collega: perde subito l'accesso ai dati dell'agenzia (che restano all'agenzia)
export async function removeMember(userId: string): Promise<{ ok: true } | { error: string }> {
  const check = await titolare();
  if ("error" in check) return { error: check.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("team_remove", { p_user: userId });
  if (error) return { error: "Non è stato possibile togliere il collega. Riprova." };
  if (data !== "ok") return { error: RESULT_TEXT[String(data)] ?? "Non è stato possibile togliere il collega." };
  revalidatePath("/dashboard/squadra");
  revalidatePath("/dashboard/trips");
  return { ok: true };
}

// Account individuale ↔ aziendale (si torna a individuale solo senza colleghi)
export async function setAccountMode(mode: "individuale" | "azienda"): Promise<{ ok: true } | { error: string }> {
  const check = await titolare();
  if ("error" in check) return { error: check.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_account_mode", { p_mode: mode });
  if (error) return { error: "Serve l'aggiornamento del database (migrazione 0075)." };
  if (data !== "ok") return { error: RESULT_TEXT[String(data)] ?? "Non è stato possibile cambiare il tipo di account." };
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
