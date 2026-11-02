"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteTemplate(templateId: string) {
  const supabase = await createClient();
  await supabase.from("activity_templates").delete().eq("id", templateId);
  revalidatePath("/dashboard/library");
}
