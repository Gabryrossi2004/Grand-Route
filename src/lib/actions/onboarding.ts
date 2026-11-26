"use server";

import { createClient } from "@/lib/supabase/server";

// Ricorda che l'introduzione di Zefiro è stata vista: non ricompare agli accessi successivi.
// (Niente revalidatePath: la pagina aperta non deve cambiare mentre Zefiro sta ancora parlando.)
export async function markOnboardingSeen() {
  const supabase = await createClient();
  await supabase.rpc("set_onboarding_seen", { p_seen: true });
}
