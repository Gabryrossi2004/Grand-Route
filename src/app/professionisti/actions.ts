"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decideAccess, safeNext } from "@/lib/areas";

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
  redirect(safeNext("pro", next) ?? decision.to);
}
