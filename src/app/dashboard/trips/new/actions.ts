"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generatePublicSlug } from "@/lib/slug";

export async function createTrip(
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Devi essere loggato." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim() || null;
  const startDate = String(formData.get("start_date") ?? "") || null;
  const endDate = String(formData.get("end_date") ?? "") || null;
  const clientId = String(formData.get("client_id") ?? "") || null;

  if (!title) {
    return { error: "Il titolo del viaggio è obbligatorio." };
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      client_id: clientId,
      public_slug: generatePublicSlug(),
    })
    .select("id")
    .single();

  if (error || !trip) {
    return { error: "Errore durante la creazione del viaggio. Riprova." };
  }

  redirect(`/dashboard/trips/${trip.id}`);
}
