"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Nasconde la lista «Per iniziare» (si riapre dal menu Account)
export async function hideOnboarding() {
  const supabase = await createClient();
  await supabase.rpc("set_onboarding_hidden", { p_hidden: true });
  revalidatePath("/", "layout");
}
