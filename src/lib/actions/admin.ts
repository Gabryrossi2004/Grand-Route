"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

// Sospende (con un motivo) o riattiva (motivo vuoto) un account. Solo amministratori: lo controlla anche il database.
export async function setUserSuspended(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get("user_id") ?? "");
  if (!UUID.test(id)) return;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  await supabase.rpc("admin_set_suspended", { p_user: id, p_reason: reason });
  revalidatePath("/dashboard/admin/utenti");
  revalidatePath("/dashboard/admin");
}

export async function handleReport(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const id = String(formData.get("report_id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!UUID.test(id) || !["gestita", "rimuovi", "riapri"].includes(action)) return;
  await supabase.rpc("admin_handle_report", { p_id: id, p_action: action });
  revalidatePath("/dashboard/admin/segnalazioni");
  revalidatePath("/dashboard/admin");
}

// Profili di prova per vedere il sito «pieno»: si creano e si tolgono da Amministrazione
export async function createDemoData(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("admin_demo_create");
  revalidatePath("/dashboard/admin");
}

export async function removeDemoData(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("admin_demo_remove");
  revalidatePath("/dashboard/admin");
}
