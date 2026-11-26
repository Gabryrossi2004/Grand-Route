"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { decideAccess, safeNext } from "@/lib/areas";

export type ClientLoginState = { error?: string; otherDoor?: boolean } | undefined;

// Accesso dei clienti: uguale per i clienti di un'agenzia e per i viaggiatori che si organizzano da soli.
// Poi ognuno va nella sua area. Un account professionale non entra da qui (ha la sua porta).
export async function clientsLogin(_prev: ClientLoginState, formData: FormData): Promise<ClientLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const { t } = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: t("auth.wrongCredentials") };

  // Collega in automatico questo account a ogni scheda cliente (di qualunque agenzia) con la stessa email:
  // così, anche se l'agenzia ha aggiunto il viaggio dopo la registrazione, lo vedi appena accedi.
  await supabase.rpc("claim_client_profiles");

  const [{ data: profile }, { data: link }] = await Promise.all([
    supabase.from("profiles").select("is_professional, is_traveler").eq("id", data.user.id).maybeSingle(),
    supabase.from("clients").select("id").eq("user_id", data.user.id).limit(1).maybeSingle(),
  ]);
  const decision = decideAccess("client", {
    is_professional: (profile as { is_professional?: boolean | null } | null)?.is_professional ?? null,
    is_traveler: (profile as { is_traveler?: boolean | null } | null)?.is_traveler ?? null,
    has_client_link: !!link,
  });
  if (!decision.ok) {
    await supabase.auth.signOut();
    return { error: t("auth.wrongAreaPro"), otherDoor: true };
  }
  redirect(safeNext("client", next) ?? decision.to);
}
