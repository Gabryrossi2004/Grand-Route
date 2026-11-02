"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createClientRecord(
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Devi essere loggato." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Il nome è obbligatorio." };

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      owner_id: user.id,
      full_name: fullName,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error || !client) return { error: "Errore durante la creazione del cliente." };

  redirect(`/dashboard/clients/${client.id}`);
}

export async function updateClient(clientId: string, formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({
      full_name: String(formData.get("full_name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", clientId);

  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function deleteClient(clientId: string) {
  const supabase = await createClient();
  await supabase.from("clients").delete().eq("id", clientId);
  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}
