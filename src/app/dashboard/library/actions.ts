"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { defaultPromptStyles } from "@/lib/defaultPromptStyles";

export async function deleteTemplate(templateId: string) {
  const supabase = await createClient();
  await supabase.from("activity_templates").delete().eq("id", templateId);
  revalidatePath("/dashboard/library");
}

// La prima volta che un'agenzia apre la scheda "Stili", le creiamo una
// decina di stili di partenza, modificabili o cancellabili liberamente.
// Chiamata dalla pagina Libreria prima di leggere gli stili esistenti.
export async function seedDefaultPromptStylesIfEmpty() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { count } = await supabase
    .from("prompt_styles")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) > 0) return;

  await supabase
    .from("prompt_styles")
    .insert(defaultPromptStyles.map((style) => ({ owner_id: user.id, ...style })));
}

export async function addPromptStyle(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const title = String(formData.get("title") ?? "").trim();
  const promptText = String(formData.get("prompt_text") ?? "").trim();
  if (!title || !promptText) return;

  await supabase.from("prompt_styles").insert({ owner_id: user.id, title, prompt_text: promptText });
  revalidatePath("/dashboard/library");
}

export async function updatePromptStyle(styleId: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const promptText = String(formData.get("prompt_text") ?? "").trim();
  if (!title || !promptText) return;

  await supabase.from("prompt_styles").update({ title, prompt_text: promptText }).eq("id", styleId);
  revalidatePath("/dashboard/library");
}

export async function deletePromptStyle(styleId: string) {
  const supabase = await createClient();
  await supabase.from("prompt_styles").delete().eq("id", styleId);
  revalidatePath("/dashboard/library");
}
