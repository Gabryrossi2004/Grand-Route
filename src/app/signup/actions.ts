"use server";

import { createClient } from "@/lib/supabase/server";

export async function signup(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");

  if (password.length < 6) {
    return { error: "La password deve avere almeno 6 caratteri." };
  }

  if (!formData.get("acceptTerms")) {
    return { error: "Devi accettare i Termini di Servizio e l'Informativa sulla Privacy." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
