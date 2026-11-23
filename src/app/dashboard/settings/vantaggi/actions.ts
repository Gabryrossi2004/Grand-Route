"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";

const PATH = "/dashboard/settings/vantaggi";

export async function saveLoyalty(formData: FormData) {
  const user = await getCachedUser();
  if (!user) return;
  const levels = [0, 1, 2, 3, 4]
    .map((i) => ({
      name: String(formData.get(`level_name_${i}`) ?? "").trim().slice(0, 40),
      min: Math.max(0, Math.floor(Number(formData.get(`level_min_${i}`)) || 0)),
      perks: String(formData.get(`level_perks_${i}`) ?? "").trim().slice(0, 300),
    }))
    .filter((l) => l.name)
    .sort((a, b) => a.min - b.min);
  const rate = Number(String(formData.get("euros_per_point") ?? "10").replace(",", "."));
  const supabase = await createClient();
  await supabase.from("agency_loyalty").upsert({
    owner_id: user.id,
    enabled: formData.get("enabled") === "on",
    euros_per_point: Number.isFinite(rate) && rate > 0 ? Math.min(10000, rate) : 10,
    intro: String(formData.get("intro") ?? "").trim().slice(0, 1000) || null,
    levels,
    updated_at: new Date().toISOString(),
  });
  revalidatePath(PATH);
}

export async function addOffer(formData: FormData) {
  const user = await getCachedUser();
  if (!user) return;
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  if (title.length < 3) return;
  const until = String(formData.get("valid_until") ?? "");
  const supabase = await createClient();
  await supabase.from("agency_offers").insert({
    owner_id: user.id,
    title,
    body: String(formData.get("body") ?? "").trim().slice(0, 2000) || null,
    valid_until: /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null,
  });
  revalidatePath(PATH);
}

export async function toggleOffer(id: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("agency_offers").update({ active }).eq("id", id);
  revalidatePath(PATH);
}

export async function deleteOffer(id: string) {
  const supabase = await createClient();
  await supabase.from("agency_offers").delete().eq("id", id);
  revalidatePath(PATH);
}

export async function addAdjustment(clientId: string, formData: FormData) {
  const user = await getCachedUser();
  if (!user) return;
  const raw = Math.trunc(Number(formData.get("points")) || 0);
  const points = formData.get("kind") === "usa" ? -Math.abs(raw) : Math.abs(raw);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  if (!points || !reason) return;
  const supabase = await createClient();
  await supabase.from("loyalty_adjustments").insert({ owner_id: user.id, client_id: clientId, points, reason });
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function deleteAdjustment(clientId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("loyalty_adjustments").delete().eq("id", id);
  revalidatePath(`/dashboard/clients/${clientId}`);
}
