"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Solo gli amministratori della piattaforma (tabella platform_admins) possono
// modificare le regole di base: lo controlla il database con le sue regole di
// sicurezza, e qui ripetiamo il controllo per dare un messaggio chiaro.
async function requireAdmin() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) return { supabase, error: "Non hai i permessi per modificare le regole di base." as const };
  return { supabase, error: null };
}

type Result = { ok: true } | { error: string };

export async function saveRule(key: string, sortOrder: number, formData: FormData): Promise<Result> {
  const { supabase, error: denied } = await requireAdmin();
  if (denied) return { error: denied };

  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  const enabled = formData.get("enabled") === "on";
  if (!title || !body) return { error: "Titolo e testo della regola non possono essere vuoti." };

  const { error } = await supabase.from("ai_platform_rules").upsert({
    key,
    title,
    body,
    enabled,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[saveRule]", error.message);
    return { error: "Non è stato possibile salvare la regola. Hai eseguito la migrazione 0033 su Supabase?" };
  }
  revalidatePath("/dashboard/admin/ai-rules");
  return { ok: true };
}

// Riporta una regola al testo predefinito (cancella la versione salvata).
export async function resetRule(key: string): Promise<Result> {
  const { supabase, error: denied } = await requireAdmin();
  if (denied) return { error: denied };
  const { error } = await supabase.from("ai_platform_rules").delete().eq("key", key);
  if (error) return { error: "Non è stato possibile ripristinare la regola." };
  revalidatePath("/dashboard/admin/ai-rules");
  return { ok: true };
}

export async function addRule(formData: FormData): Promise<Result> {
  const { supabase, error: denied } = await requireAdmin();
  if (denied) return { error: denied };

  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (!title || !body) return { error: "Scrivi un titolo e il testo della regola." };

  const { error } = await supabase.from("ai_platform_rules").insert({
    key: `custom_${Date.now()}`,
    title,
    body,
    enabled: true,
    sort_order: 500,
  });
  if (error) {
    console.error("[addRule]", error.message);
    return { error: "Non è stato possibile aggiungere la regola." };
  }
  revalidatePath("/dashboard/admin/ai-rules");
  return { ok: true };
}
