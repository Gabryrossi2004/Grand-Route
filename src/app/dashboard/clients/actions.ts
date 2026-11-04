"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parseDetailFields(formData: FormData) {
  return {
    date_of_birth: String(formData.get("date_of_birth") ?? "").trim() || null,
    place_of_birth: String(formData.get("place_of_birth") ?? "").trim() || null,
    nationality: String(formData.get("nationality") ?? "").trim() || null,
    fiscal_code: String(formData.get("fiscal_code") ?? "").trim() || null,
    residence_address: String(formData.get("residence_address") ?? "").trim() || null,
    id_card_number: String(formData.get("id_card_number") ?? "").trim() || null,
    id_card_expiry: String(formData.get("id_card_expiry") ?? "").trim() || null,
    passport_number: String(formData.get("passport_number") ?? "").trim() || null,
    passport_expiry: String(formData.get("passport_expiry") ?? "").trim() || null,
  };
}

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
      ...parseDetailFields(formData),
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
      ...parseDetailFields(formData),
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

export async function linkTripToClient(clientId: string, formData: FormData) {
  const tripId = String(formData.get("trip_id") ?? "");
  if (!tripId) return;

  const supabase = await createClient();
  await supabase.from("trips").update({ client_id: clientId }).eq("id", tripId);
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function unlinkTripFromClient(clientId: string, tripId: string) {
  const supabase = await createClient();
  await supabase.from("trips").update({ client_id: null }).eq("id", tripId).eq("client_id", clientId);
  revalidatePath(`/dashboard/clients/${clientId}`);
}
