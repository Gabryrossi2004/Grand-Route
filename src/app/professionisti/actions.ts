"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decideAccess, safeNext } from "@/lib/areas";
import { TEAM_INVITE_PATH } from "@/lib/teamInvite";

export type ProLoginState = { error?: string; otherDoor?: boolean } | undefined;

// Accesso dei professionisti del turismo. Entrano solo account professionali: un cliente o un viaggiatore viene
// rimandato alla sua porta (l'area clienti), senza restare collegato qui.
export async function professionalLogin(_prev: ProLoginState, formData: FormData): Promise<ProLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Email o password non corrette." };

  const { data: profile } = await supabase.from("profiles").select("is_professional, is_traveler").eq("id", data.user.id).maybeSingle();
  const decision = decideAccess("pro", {
    is_professional: (profile as { is_professional?: boolean | null } | null)?.is_professional ?? null,
    is_traveler: (profile as { is_traveler?: boolean | null } | null)?.is_traveler ?? null,
    has_client_link: false,
  });
  if (!decision.ok) {
    await supabase.auth.signOut();
    return { error: "Questo account è di un cliente o di un viaggiatore, non di un professionista del turismo.", otherDoor: true };
  }
  // Chi si è registrato dal link di un collega: lega l'invito (una volta sola; senza la migrazione 0074 non succede nulla)
  await supabase.rpc("claim_referral");
  // Chi si è registrato dall'invito di un'agenzia entra nel suo team (senza la migrazione 0075 non succede nulla)
  const teamToken = (data.user.user_metadata as { team_invite?: unknown } | null)?.team_invite;
  if (typeof teamToken === "string" && teamToken) {
    const { data: outcome } = await supabase.rpc("accept_team_invite");
    if (typeof outcome === "string" && !["none", "ok", "gia_membro", "usato"].includes(outcome)) {
      // invito non valido (scaduto, email diversa, account con dati…): si spiega una volta sola e si toglie il codice
      await supabase.auth.updateUser({ data: { team_invite: null } });
      redirect(`${TEAM_INVITE_PATH}/${encodeURIComponent(teamToken)}?esito=${outcome}`);
    }
  }
  redirect(safeNext("pro", next) ?? decision.to);
}
