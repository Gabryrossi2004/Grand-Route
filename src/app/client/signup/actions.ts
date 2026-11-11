"use server";

import { createClient } from "@/lib/supabase/server";

export async function clientSignup(
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

  // Se la conferma email non è richiesta, signUp crea già una sessione
  // attiva: colleghiamo subito le schede cliente corrispondenti, invece di
  // aspettare un login separato che potrebbe non arrivare mai.
  await supabase.rpc("claim_client_profiles");
  // Marca l'account come cliente SOLO qui, alla registrazione: mai ad ogni
  // login (vedi 0023_fix_is_professional_on_login.sql).
  await supabase.rpc("mark_current_user_as_client");

  return { success: true };
}
