"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generatePublicSlug } from "@/lib/slug";
import { CHECK_OUT_DATE_KEY } from "@/lib/activityTypes";
import type { Activity, TripDay } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Tutte le date (incluse) tra il giorno dopo "startDate" e "endDate".
function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Trova il giorno del viaggio con questa data, o lo crea se non esiste ancora.
async function ensureDayForDate(
  supabase: SupabaseServerClient,
  tripId: string,
  dateStr: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("trip_days")
    .select("id")
    .eq("trip_id", tripId)
    .eq("day_date", dateStr)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("trip_days")
    .insert({ trip_id: tripId, day_date: dateStr, day_order: 0 })
    .select("id")
    .single();
  return created?.id ?? null;
}

// Rimette in ordine cronologico i giorni del viaggio (quelli senza data restano
// nella loro posizione relativa), dopo che ne sono stati creati di nuovi.
async function resyncDayOrder(supabase: SupabaseServerClient, tripId: string) {
  const { data: days } = await supabase
    .from("trip_days")
    .select("id, day_date, day_order")
    .eq("trip_id", tripId);
  if (!days) return;

  const sorted = [...days].sort((a, b) => {
    if (a.day_date && b.day_date) return a.day_date.localeCompare(b.day_date);
    if (a.day_date && !b.day_date) return -1;
    if (!a.day_date && b.day_date) return 1;
    return a.day_order - b.day_order;
  });

  await Promise.all(
    sorted.map((day, index) => supabase.from("trip_days").update({ day_order: index }).eq("id", day.id)),
  );
}

// Quando un alloggio ha una data di check-out, crea automaticamente i giorni
// mancanti dell'itinerario e aggiunge un'attività "Check-out" nel giorno giusto.
async function handleLodgingCheckout(
  supabase: SupabaseServerClient,
  tripId: string,
  dayId: string,
  title: string,
  details: Record<string, string>,
) {
  const checkOutDate = details[CHECK_OUT_DATE_KEY];
  if (!checkOutDate) return;

  const { data: currentDay } = await supabase.from("trip_days").select("day_date").eq("id", dayId).single();
  if (!currentDay?.day_date || checkOutDate <= currentDay.day_date) return;

  const datesToEnsure = dateRange(currentDay.day_date, checkOutDate);
  let checkoutDayId: string | null = null;
  for (const dateStr of datesToEnsure) {
    const id = await ensureDayForDate(supabase, tripId, dateStr);
    if (dateStr === checkOutDate) checkoutDayId = id;
  }

  if (checkoutDayId) {
    const checkoutTitle = `Check-out: ${title}`;
    const { data: existingCheckout } = await supabase
      .from("activities")
      .select("id")
      .eq("trip_day_id", checkoutDayId)
      .eq("title", checkoutTitle)
      .maybeSingle();

    if (!existingCheckout) {
      const { count } = await supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("trip_day_id", checkoutDayId);

      await supabase.from("activities").insert({
        trip_day_id: checkoutDayId,
        title: checkoutTitle,
        activity_type: "alloggio",
        start_time: details.check_out || null,
        activity_order: count ?? 0,
      });
    }
  }

  await resyncDayOrder(supabase, tripId);
}

// Quando un volo ha i dati di arrivo (città, IATA e data presi dalla ricerca
// automatica), crea il blocco "Arrivo a ..." nel giorno giusto: lo stesso
// giorno della partenza se il volo arriva in giornata, oppure crea i giorni
// mancanti dell'itinerario se arriva il giorno dopo (o più avanti).
async function handleFlightArrival(
  supabase: SupabaseServerClient,
  tripId: string,
  dayId: string,
  details: Record<string, string>,
) {
  const arrivalCity = details._arrivo_citta;
  const arrivalIata = details._arrivo_iata;
  const arrivalDate = details._arrivo_data;
  if (!arrivalCity || !arrivalIata || !arrivalDate) return;

  const { data: currentDay } = await supabase.from("trip_days").select("day_date").eq("id", dayId).single();
  if (!currentDay?.day_date || arrivalDate < currentDay.day_date) return;

  let arrivalDayId: string | null = dayId;
  if (arrivalDate > currentDay.day_date) {
    arrivalDayId = null;
    for (const dateStr of dateRange(currentDay.day_date, arrivalDate)) {
      const id = await ensureDayForDate(supabase, tripId, dateStr);
      if (dateStr === arrivalDate) arrivalDayId = id;
    }
  }
  if (!arrivalDayId) return;

  const arrivalTitle = `Arrivo a ${arrivalCity} (${arrivalIata})`;
  const { data: existingArrival } = await supabase
    .from("activities")
    .select("id")
    .eq("trip_day_id", arrivalDayId)
    .eq("title", arrivalTitle)
    .maybeSingle();

  if (!existingArrival) {
    const { count } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("trip_day_id", arrivalDayId);

    await supabase.from("activities").insert({
      trip_day_id: arrivalDayId,
      title: arrivalTitle,
      activity_type: "volo",
      start_time: details.orario_arrivo || null,
      activity_order: count ?? 0,
    });
  }

  await resyncDayOrder(supabase, tripId);
}

export async function updateTripInfo(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim() || null;
  const startDate = String(formData.get("start_date") ?? "") || null;
  const endDate = String(formData.get("end_date") ?? "") || null;
  const priceMode = String(formData.get("price_mode") ?? "nessuno");
  const priceAmount = formData.get("price_amount") ? Number(formData.get("price_amount")) : null;
  const priceNet = formData.get("price_net") ? Number(formData.get("price_net")) : null;
  const priceCommission = formData.get("price_commission") ? Number(formData.get("price_commission")) : null;
  const titleColor = String(formData.get("title_color") ?? "").trim() || null;

  await supabase
    .from("trips")
    .update({
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      price_mode: priceMode,
      price_amount: priceMode === "lordo" ? priceAmount : null,
      price_net: priceMode === "commissioni" ? priceNet : null,
      price_commission: priceMode === "commissioni" ? priceCommission : null,
      title_color: titleColor,
    })
    .eq("id", tripId);

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function togglePublish(tripId: string, isPublished: boolean) {
  const supabase = await createClient();
  await supabase.from("trips").update({ is_published: !isPublished }).eq("id", tripId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function updateTripTheme(tripId: string, formData: FormData) {
  const theme = String(formData.get("theme") ?? "");
  if (!theme) return;
  const supabase = await createClient();
  await supabase.from("trips").update({ theme }).eq("id", tripId);
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/overview`);
}

export async function deleteTrip(tripId: string): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessione scaduta: ricarica la pagina ed effettua di nuovo l'accesso." };
  }

  const { error, count } = await supabase
    .from("trips")
    .delete({ count: "exact" })
    .eq("id", tripId);

  if (error) {
    return { error: "Impossibile eliminare il viaggio: " + error.message };
  }
  if (!count) {
    return {
      error: "Il viaggio non risulta eliminabile da questo account (non ne sei il proprietario o non esiste più).",
    };
  }

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

export async function updateDayTitle(tripId: string, dayId: string, title: string) {
  const supabase = await createClient();
  const clean = title.trim();
  await supabase
    .from("trip_days")
    .update({ title: clean || null })
    .eq("id", dayId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

// Scambia il contenuto (attività, titolo, note) tra due giorni trascinati
// uno sull'altro. Le date e l'ordine dei giorni restano fissi: cambia solo
// cosa c'è pianificato in ciascuna data.
export async function swapDayContent(tripId: string, dayAId: string, dayBId: string) {
  if (dayAId === dayBId) return;
  const supabase = await createClient();

  const [{ data: activitiesA }, { data: activitiesB }, { data: dayA }, { data: dayB }] = await Promise.all([
    supabase.from("activities").select("id").eq("trip_day_id", dayAId),
    supabase.from("activities").select("id").eq("trip_day_id", dayBId),
    supabase.from("trip_days").select("title, notes").eq("id", dayAId).single(),
    supabase.from("trip_days").select("title, notes").eq("id", dayBId).single(),
  ]);

  const idsA = (activitiesA || []).map((a) => a.id);
  const idsB = (activitiesB || []).map((a) => a.id);

  await Promise.all([
    idsA.length > 0 ? supabase.from("activities").update({ trip_day_id: dayBId }).in("id", idsA) : null,
    idsB.length > 0 ? supabase.from("activities").update({ trip_day_id: dayAId }).in("id", idsB) : null,
    supabase.from("trip_days").update({ title: dayB?.title ?? null, notes: dayB?.notes ?? null }).eq("id", dayAId),
    supabase.from("trip_days").update({ title: dayA?.title ?? null, notes: dayA?.notes ?? null }).eq("id", dayBId),
  ]);

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function moveActivityToDay(tripId: string, activityId: string, targetDayId: string) {
  const supabase = await createClient();

  const { data: lastActivity } = await supabase
    .from("activities")
    .select("activity_order")
    .eq("trip_day_id", targetDayId)
    .order("activity_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = lastActivity ? lastActivity.activity_order + 1 : 0;

  await supabase
    .from("activities")
    .update({ trip_day_id: targetDayId, activity_order: nextOrder })
    .eq("id", activityId);

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

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const startTime = String(formData.get("start_time") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const activityType = String(formData.get("activity_type") ?? "altro");
  const details = parseDetails(formData);

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

  if (activityType === "alloggio") {
    await handleLodgingCheckout(supabase, tripId, dayId, title, details);
  } else if (activityType === "volo") {
    await handleFlightArrival(supabase, tripId, dayId, details);
  }

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function deleteActivity(tripId: string, activityId: string) {
  const supabase = await createClient();
  await supabase.from("activities").delete().eq("id", activityId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function updateActivity(tripId: string, activityId: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const startTime = String(formData.get("start_time") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const activityType = String(formData.get("activity_type") ?? "altro");
  const details = parseDetails(formData);

  await supabase
    .from("activities")
    .update({
      title,
      start_time: startTime,
      description,
      location,
      activity_type: activityType,
      details,
    })
    .eq("id", activityId);

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function saveActivityToLibrary(tripId: string, activityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: activity } = await supabase.from("activities").select("*").eq("id", activityId).single();
  if (!activity) return;

  await supabase.from("activity_templates").insert({
    owner_id: user.id,
    activity_type: activity.activity_type,
    title: activity.title,
    description: activity.description,
    location: activity.location,
    details: activity.details,
  });

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function duplicateActivity(tripId: string, dayId: string, activityId: string) {
  const supabase = await createClient();
  const { data: activity } = await supabase.from("activities").select("*").eq("id", activityId).single();
  if (!activity) return;

  const { count } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("trip_day_id", dayId);

  await supabase.from("activities").insert({
    trip_day_id: dayId,
    title: `${activity.title} (copia)`,
    start_time: activity.start_time,
    description: activity.description,
    location: activity.location,
    activity_type: activity.activity_type,
    details: activity.details,
    activity_order: count ?? 0,
  });

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function moveActivity(
  tripId: string,
  dayId: string,
  activityId: string,
  direction: "up" | "down",
) {
  const supabase = await createClient();
  const { data: activities } = await supabase
    .from("activities")
    .select("id, activity_order")
    .eq("trip_day_id", dayId)
    .order("activity_order", { ascending: true });

  if (!activities) return;
  const index = activities.findIndex((a) => a.id === activityId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= activities.length) return;

  const current = activities[index];
  const swapWith = activities[swapIndex];

  await supabase.from("activities").update({ activity_order: swapWith.activity_order }).eq("id", current.id);
  await supabase.from("activities").update({ activity_order: current.activity_order }).eq("id", swapWith.id);

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function reorderActivities(tripId: string, orderedActivityIds: string[]) {
  const supabase = await createClient();
  await Promise.all(
    orderedActivityIds.map((activityId, index) =>
      supabase.from("activities").update({ activity_order: index }).eq("id", activityId),
    ),
  );
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function sortActivitiesByTime(tripId: string, dayId: string) {
  const supabase = await createClient();
  const { data: activities } = await supabase
    .from("activities")
    .select("id, start_time")
    .eq("trip_day_id", dayId);

  if (!activities) return;

  const sorted = [...activities].sort((a, b) => {
    if (!a.start_time && !b.start_time) return 0;
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return a.start_time.localeCompare(b.start_time);
  });

  await Promise.all(
    sorted.map((activity, index) =>
      supabase.from("activities").update({ activity_order: index }).eq("id", activity.id),
    ),
  );

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function uploadDocument(
  tripId: string,
  activityId: string | null,
  formData: FormData,
) {
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
    activity_id: activityId,
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
