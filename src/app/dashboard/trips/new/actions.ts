"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generatePublicSlug } from "@/lib/slug";

const MAX_AUTO_DAYS = 90;

function dateRange(start: string, end: string): string[] {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return [];

  const dates: string[] = [];
  const cursor = startDate;
  while (cursor <= endDate && dates.length < MAX_AUTO_DAYS) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

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
  const priceMode = String(formData.get("price_mode") ?? "nessuno");
  const priceAmount = formData.get("price_amount") ? Number(formData.get("price_amount")) : null;
  const priceNet = formData.get("price_net") ? Number(formData.get("price_net")) : null;
  const priceCommission = formData.get("price_commission") ? Number(formData.get("price_commission")) : null;

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
      price_mode: priceMode,
      price_amount: priceMode === "lordo" ? priceAmount : null,
      price_net: priceMode === "commissioni" ? priceNet : null,
      price_commission: priceMode === "commissioni" ? priceCommission : null,
    })
    .select("id")
    .single();

  if (error || !trip) {
    return { error: "Errore durante la creazione del viaggio. Riprova." };
  }

  if (startDate && endDate) {
    const days = dateRange(startDate, endDate);
    if (days.length > 0) {
      await supabase.from("trip_days").insert(
        days.map((day_date, index) => ({
          trip_id: trip.id,
          day_date,
          day_order: index,
        })),
      );
    }
  }

  redirect(`/dashboard/trips/${trip.id}`);
}
