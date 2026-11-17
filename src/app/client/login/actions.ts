"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export async function clientLogin(_prevState: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { t } = await getT();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: t("auth.wrongCredentials") };
  }

  // Collega in automatico questo account a ogni scheda cliente (di
  // qualunque agenzia) che ha la stessa email e non è ancora collegata a
  // nessuno: così, anche se l'agenzia ha aggiunto il viaggio dopo la tua
  // registrazione, lo vedi comunque appena accedi.
  await supabase.rpc("claim_client_profiles");

  redirect("/client");
}
