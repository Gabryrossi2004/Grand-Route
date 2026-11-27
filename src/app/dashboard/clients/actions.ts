"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { encryptField } from "@/lib/encryption";
import { companyIdOf } from "@/lib/team";

// Dati anagrafici e documenti d'identità: cifrati prima di essere salvati
// (vedi src/lib/encryption.ts), così restano illeggibili anche con accesso
// diretto al database.
function parseDetailFields(formData: FormData) {
  return {
    date_of_birth: encryptField(String(formData.get("date_of_birth") ?? "").trim() || null),
    place_of_birth: encryptField(String(formData.get("place_of_birth") ?? "").trim() || null),
    nationality: encryptField(String(formData.get("nationality") ?? "").trim() || null),
    fiscal_code: encryptField(String(formData.get("fiscal_code") ?? "").trim() || null),
    residence_address: encryptField(String(formData.get("residence_address") ?? "").trim() || null),
    id_card_number: encryptField(String(formData.get("id_card_number") ?? "").trim() || null),
    id_card_expiry: encryptField(String(formData.get("id_card_expiry") ?? "").trim() || null),
    passport_number: encryptField(String(formData.get("passport_number") ?? "").trim() || null),
    passport_expiry: encryptField(String(formData.get("passport_expiry") ?? "").trim() || null),
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
  const companyId = await companyIdOf(user.id);

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Il nome è obbligatorio." };

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      owner_id: companyId,
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
