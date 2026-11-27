"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACCEPT_MESSAGES } from "@/lib/teamInvite";

export type JoinState = { error?: string; checkEmail?: boolean } | undefined;
type InviteInfo = { agency: string; email: string; role: string; state: string } | null;

async function inviteInfo(token: string): Promise<InviteInfo> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("team_invite_info", { p_token: token });
  return (data as InviteInfo) ?? null;
}

// Nuovo collaboratore: crea l'account con l'email dell'invito. Entra nella squadra al primo accesso
// (subito, se Supabase non chiede di confermare l'email).
export async function joinTeamSignup(token: string, _prev: JoinState, formData: FormData): Promise<JoinState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (fullName.length < 2) return { error: "Scrivi nome e cognome." };
  if (password.length < 6) return { error: "La password deve avere almeno 6 caratteri." };
  if (!formData.get("acceptTerms")) return { error: "Devi accettare i Termini di Servizio e l'Informativa sulla Privacy." };

  const info = await inviteInfo(token);
  if (!info) return { error: ACCEPT_MESSAGES.non_trovato };
  if (info.state !== "valido") return { error: ACCEPT_MESSAGES[info.state === "usato" ? "usato" : info.state === "scaduto" ? "scaduto" : "revocato"] };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: info.email,
    password,
    // business_kind: per il sito è un account professionale; team_invite: il codice da usare al primo accesso
    options: { data: { full_name: fullName, business_kind: "agenzia", team_invite: token } },
  });
  if (error) {
    if (/registered|exists/i.test(error.message)) {
      return { error: "Questa email ha già un account: accedi con la tua password e poi riapri questo link." };
    }
    return { error: error.message };
  }
  if (!data.session) return { checkEmail: true };

  const { data: outcome } = await supabase.rpc("accept_team_invite");
  if (outcome === "ok" || outcome === "gia_membro") redirect("/dashboard");
  return { error: ACCEPT_MESSAGES[String(outcome)] ?? "Account creato, ma non sono riuscito a farti entrare nella squadra. Riprova ad accedere." };
}

// Chi ha già un account (senza dati propri) ed è collegato con l'email dell'invito
export async function joinTeamAsCurrentUser(token: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_team_invite", { p_token: token });
  if (error) return { error: "Serve l'aggiornamento del database (migrazione 0075)." };
  if (data === "ok" || data === "gia_membro") redirect("/dashboard");
  return { error: ACCEPT_MESSAGES[String(data)] ?? "Non è stato possibile entrare nella squadra." };
}
