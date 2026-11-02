"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generatePublicSlug } from "@/lib/slug";
import type { Activity, TripDay } from "@/lib/types";

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

function parseDetails(formData: FormData): Record<string, string> {
  const raw = String(formData.get("details") ?? "{}");
  try {
    const parsed = JSON.parse(raw);
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) clean[key] = value.trim();
    }
    return clean;
  } catch {
    return {};
  }
}

export async function addActivity(tripId: string, dayId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const startTime = String(formData.get("start_time") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const activityType = String(formData.get("activity_type") ?? "altro");
  const details = parseDetails(formData);
  const saveToLibrary = formData.get("save_to_library") === "on";

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
    activity_type: activityType,
    details,
    activity_order: count ?? 0,
  });

  if (saveToLibrary && user) {
    await supabase.from("activity_templates").insert({
      owner_id: user.id,
      activity_type: activityType,
      title,
      description,
      location,
      details,
    });
  }

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

export async function uploadActivityPhoto(tripId: string, activityId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  const filePath = `${user.id}/activities/${activityId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("public-assets")
    .upload(filePath, file, { contentType: file.type || undefined });

  if (uploadError) return;

  const { data } = supabase.storage.from("public-assets").getPublicUrl(filePath);

  await supabase
    .from("activity_photos")
    .insert({ activity_id: activityId, url: data.publicUrl, file_path: filePath });
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function deleteActivityPhoto(tripId: string, photoId: string, filePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("public-assets").remove([filePath]);
  await supabase.from("activity_photos").delete().eq("id", photoId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function uploadCover(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) return;

  const filePath = `${user.id}/trips/${tripId}/cover-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("public-assets")
    .upload(filePath, file, { contentType: file.type || undefined });

  if (uploadError) return;

  const { data } = supabase.storage.from("public-assets").getPublicUrl(filePath);

  await supabase.from("trips").update({ cover_image_url: data.publicUrl }).eq("id", tripId);
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard/trips");
}

export async function duplicateTripAsVariant(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).single();
  if (!trip) return;

  let groupId: string | null = trip.group_id;
  if (!groupId) {
    const { data: group } = await supabase
      .from("trip_groups")
      .insert({ owner_id: user.id, client_id: trip.client_id, title: trip.title })
      .select("id")
      .single();
    groupId = group?.id ?? null;
    if (groupId) {
      await supabase.from("trips").update({ group_id: groupId }).eq("id", tripId);
    }
  }

  const { data: newTrip } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      client_id: trip.client_id,
      group_id: groupId,
      title: `${trip.title} (variante)`,
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
      cover_image_url: trip.cover_image_url,
      public_slug: generatePublicSlug(),
      is_published: false,
    })
    .select("id")
    .single();

  if (!newTrip) return;

  const { data: days } = await supabase
    .from("trip_days")
    .select("*, activities(*)")
    .eq("trip_id", tripId)
    .order("day_order", { ascending: true });

  for (const day of (days as (TripDay & { activities: Activity[] })[]) || []) {
    const { data: newDay } = await supabase
      .from("trip_days")
      .insert({ trip_id: newTrip.id, day_date: day.day_date, day_order: day.day_order, notes: day.notes })
      .select("id")
      .single();

    if (newDay && day.activities?.length) {
      await supabase.from("activities").insert(
        day.activities.map((activity) => ({
          trip_day_id: newDay.id,
          start_time: activity.start_time,
          title: activity.title,
          description: activity.description,
          location: activity.location,
          activity_type: activity.activity_type,
          details: activity.details,
          activity_order: activity.activity_order,
        })),
      );
    }
  }

  revalidatePath("/dashboard/trips");
  redirect(`/dashboard/trips/${newTrip.id}`);
}
