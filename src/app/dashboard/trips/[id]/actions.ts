"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateTripInfo(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim() || null;
  const startDate = String(formData.get("start_date") ?? "") || null;
  const endDate = String(formData.get("end_date") ?? "") || null;

  await supabase
    .from("trips")
    .update({ title, destination, start_date: startDate, end_date: endDate })
    .eq("id", tripId);

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function togglePublish(tripId: string, isPublished: boolean) {
  const supabase = await createClient();
  await supabase.from("trips").update({ is_published: !isPublished }).eq("id", tripId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function deleteTrip(tripId: string) {
  const supabase = await createClient();
  await supabase.from("trips").delete().eq("id", tripId);
  revalidatePath("/dashboard/trips");
  redirect("/dashboard/trips");
}

export async function addDay(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const dayDate = String(formData.get("day_date") ?? "") || null;

  const { count } = await supabase
    .from("trip_days")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  await supabase.from("trip_days").insert({
    trip_id: tripId,
    day_date: dayDate,
    day_order: count ?? 0,
  });

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function deleteDay(tripId: string, dayId: string) {
  const supabase = await createClient();
  await supabase.from("trip_days").delete().eq("id", dayId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function addActivity(tripId: string, dayId: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const startTime = String(formData.get("start_time") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;

  const { count } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("trip_day_id", dayId);

  await supabase.from("activities").insert({
    trip_day_id: dayId,
    title,
    start_time: startTime,
    description,
    location,
    activity_order: count ?? 0,
  });

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function deleteActivity(tripId: string, activityId: string) {
  const supabase = await createClient();
  await supabase.from("activities").delete().eq("id", activityId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function uploadDocument(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const filePath = `${user.id}/${tripId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("trip-documents")
    .upload(filePath, file, { contentType: file.type || undefined });

  if (uploadError) return;

  await supabase.from("documents").insert({
    trip_id: tripId,
    file_name: file.name,
    file_path: filePath,
    file_type: file.type || null,
  });

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function deleteDocument(tripId: string, documentId: string, filePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("trip-documents").remove([filePath]);
  await supabase.from("documents").delete().eq("id", documentId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}
