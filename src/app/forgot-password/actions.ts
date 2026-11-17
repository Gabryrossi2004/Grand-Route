"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export async function requestPasswordReset(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "").trim();
  const { t } = await getT();
  if (!email) return { error: t("auth.enterEmail") };

  const host = (await headers()).get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  // Mostriamo sempre lo stesso messaggio, anche se l'email non esiste:
  // così nessuno può scoprire se un indirizzo è registrato o no.
  return { success: true };
}
