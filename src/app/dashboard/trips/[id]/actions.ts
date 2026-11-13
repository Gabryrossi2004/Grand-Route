"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generatePublicSlug } from "@/lib/slug";
import { CHECK_OUT_DATE_KEY, confirmationDetailKey, detailFields } from "@/lib/activityTypes";
import { validateDocumentFile, validateImageFile, validateSpreadsheetFile, validateTextFile } from "@/lib/fileValidation";
import { generateItineraryFromDraft, type DraftImage } from "@/lib/itineraryAi";
import { parseExcelToText } from "@/lib/itineraryFileParsing";
import type {
  Activity,
  ActivityType,
  ItineraryStage,
  PaymentDirection,
  ServiceStatus,
  TripChecklistItem,
  TripDay,
} from "@/lib/types";

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

// Modifica rapida del solo titolo (doppio click sul titolo in cima alla
// pagina del viaggio), separata da updateTripInfo che invece salva l'intero
// modulo "Informazioni viaggio" insieme.
export async function updateTripTitle(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await supabase.from("trips").update({ title }).eq("id", tripId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

// Blocco "Tariffa & Termini": facoltativo, specifico per viaggio (incluso/
// escluso), riusa invece il testo dei Termini e Condizioni scritto una volta
// sola nelle Impostazioni dell'agenzia. Visibile al cliente solo se attivato.
export async function updateTripRateBlock(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const rateIncludes = String(formData.get("rate_includes") ?? "").trim() || null;
  const rateExcludes = String(formData.get("rate_excludes") ?? "").trim() || null;
  const showRateBlock = formData.get("show_rate_block") === "on";

  await supabase
    .from("trips")
    .update({ rate_includes: rateIncludes, rate_excludes: rateExcludes, show_rate_block: showRateBlock })
    .eq("id", tripId);

  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/preview`);
}

// Tasto "Emergenza" mostrato al cliente nella sua area riservata: facoltativo
// per singolo viaggio, visto che non tutte le agenzie hanno un numero attivo
// h24 (il numero stesso si imposta una volta sola nelle Impostazioni).
export async function updateTripEmergencyButton(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const showEmergencyButton = formData.get("show_emergency_button") === "on";

  await supabase.from("trips").update({ show_emergency_button: showEmergencyButton }).eq("id", tripId);

  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath(`/client/trips/${tripId}`);
}

// "2 versioni" dello stesso viaggio: preliminare (bozza generica, inviata al
// cliente/agente per conferma) o finale (dettagli reali dopo la prenotazione
// dei servizi). Un unico interruttore, nessuna scheda duplicata.
export async function updateItineraryStage(tripId: string, currentStage: ItineraryStage) {
  const supabase = await createClient();
  const nextStage: ItineraryStage = currentStage === "finale" ? "preliminare" : "finale";
  await supabase.from("trips").update({ itinerary_stage: nextStage }).eq("id", tripId);
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/preview`);
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
  revalidatePath(`/trips/${tripId}/preview`);
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

// Eliminare una variante dalla pagina di un'ALTRA variante dello stesso
// gruppo (sezione "Varianti di questo viaggio"): a differenza di
// deleteTrip, qui non si reindirizza alla lista viaggi, perché l'agenzia
// deve restare sul viaggio che stava guardando.
export async function deleteTripVariant(
  currentTripId: string,
  variantId: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessione scaduta: ricarica la pagina ed effettua di nuovo l'accesso." };
  }

  const { error, count } = await supabase.from("trips").delete({ count: "exact" }).eq("id", variantId);

  if (error) {
    return { error: "Impossibile eliminare la variante: " + error.message };
  }
  if (!count) {
    return {
      error: "La variante non risulta eliminabile da questo account (non ne sei il proprietario o non esiste più).",
    };
  }

  revalidatePath(`/dashboard/trips/${currentTripId}`);
  revalidatePath("/dashboard/trips");
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

// Imposta la data del primo giorno e sposta di conseguenza tutte le altre
// date dell'itinerario, mantenendo la stessa distanza in giorni tra loro
// (day_order è già un indice continuo a partire da 0, tenuto in ordine da
// resyncDayOrder). Aggiorna anche start_date/end_date del viaggio, usati
// altrove (lista viaggi, calendario, promemoria di partenza).
export async function rebaseTripDates(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const newFirstDate = String(formData.get("new_first_date") ?? "");
  if (!newFirstDate) return;

  const { data: days } = await supabase
    .from("trip_days")
    .select("id, day_order")
    .eq("trip_id", tripId)
    .order("day_order", { ascending: true });
  if (!days || days.length === 0) return;

  const updatedRows = days.map((day) => ({
    id: day.id,
    trip_id: tripId,
    day_order: day.day_order,
    day_date: addDaysToDate(newFirstDate, day.day_order),
  }));
  await supabase.from("trip_days").upsert(updatedRows, { onConflict: "id" });

  const lastDate = addDaysToDate(newFirstDate, days[days.length - 1].day_order);
  await supabase.from("trips").update({ start_date: newFirstDate, end_date: lastDate }).eq("id", tripId);

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
  if (validateDocumentFile(file)) return;

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
  const { data: existing } = await supabase
    .from("documents")
    .select("cover_image_path")
    .eq("id", documentId)
    .maybeSingle();

  const pathsToRemove = [filePath, ...(existing?.cover_image_path ? [existing.cover_image_path] : [])];
  await supabase.storage.from("trip-documents").remove(pathsToRemove);
  await supabase.from("documents").delete().eq("id", documentId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function renameDocument(tripId: string, documentId: string, formData: FormData) {
  const supabase = await createClient();
  const fileName = String(formData.get("file_name") ?? "").trim();
  if (!fileName) return;
  await supabase.from("documents").update({ file_name: fileName }).eq("id", documentId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

// Foto di copertina opzionale per un documento già caricato: puramente
// organizzativa (es. riconoscere a colpo d'occhio la prima pagina di un
// passaporto), salvata nello stesso bucket privato dei documenti stessi.
export async function uploadDocumentCover(tripId: string, documentId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (validateImageFile(file)) return;

  const { data: existing } = await supabase
    .from("documents")
    .select("cover_image_path")
    .eq("id", documentId)
    .maybeSingle();

  const coverPath = `${user.id}/${tripId}/covers/${documentId}-${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("trip-documents")
    .upload(coverPath, file, { contentType: file.type || undefined });
  if (uploadError) return;

  await supabase.from("documents").update({ cover_image_path: coverPath }).eq("id", documentId);

  if (existing?.cover_image_path) {
    await supabase.storage.from("trip-documents").remove([existing.cover_image_path]);
  }

  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function deleteDocumentCover(tripId: string, documentId: string, coverPath: string) {
  const supabase = await createClient();
  await supabase.storage.from("trip-documents").remove([coverPath]);
  await supabase.from("documents").update({ cover_image_path: null }).eq("id", documentId);
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
  if (validateImageFile(file)) return;

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
  if (validateImageFile(file)) return;

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
  const sourceDays = (days as (TripDay & { activities: Activity[] })[]) || [];

  // Un solo inserimento per tutti i giorni, poi uno solo per tutte le
  // attività: con viaggi lunghi (tanti giorni/attività), inserire riga per
  // riga in sequenza era lento e dava l'impressione che il tasto non
  // avesse funzionato.
  if (sourceDays.length > 0) {
    const { data: newDays } = await supabase
      .from("trip_days")
      .insert(
        sourceDays.map((day) => ({
          trip_id: newTrip.id,
          day_date: day.day_date,
          day_order: day.day_order,
          notes: day.notes,
        })),
      )
      .select("id, day_order");

    const newDayIdByOrder = new Map((newDays || []).map((d) => [d.day_order, d.id as string]));

    const activityRows = sourceDays.flatMap((day) => {
      const newDayId = newDayIdByOrder.get(day.day_order);
      if (!newDayId || !day.activities?.length) return [];
      return day.activities.map((activity) => ({
        trip_day_id: newDayId,
        start_time: activity.start_time,
        title: activity.title,
        description: activity.description,
        location: activity.location,
        activity_type: activity.activity_type,
        details: activity.details,
        activity_order: activity.activity_order,
      }));
    });

    if (activityRows.length > 0) {
      await supabase.from("activities").insert(activityRows);
    }
  }

  revalidatePath("/dashboard/trips");
  redirect(`/dashboard/trips/${newTrip.id}`);
}

export async function addChecklistItem(
  tripId: string,
  formData: FormData,
): Promise<TripChecklistItem | null> {
  const supabase = await createClient();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return null;

  const { count } = await supabase
    .from("trip_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  const { data } = await supabase
    .from("trip_checklist_items")
    .insert({ trip_id: tripId, label, item_order: count ?? 0 })
    .select()
    .single();

  revalidatePath(`/dashboard/trips/${tripId}`);
  return (data as TripChecklistItem) ?? null;
}

export async function toggleChecklistItem(tripId: string, itemId: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("trip_checklist_items").update({ done }).eq("id", itemId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function deleteChecklistItem(tripId: string, itemId: string) {
  const supabase = await createClient();
  await supabase.from("trip_checklist_items").delete().eq("id", itemId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

// Servizi e fornitori: pannello separato, opzionale, apribile dalla pagina
// del viaggio ma non parte della costruzione dell'itinerario.
function readServiceFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    status: (String(formData.get("status") ?? "da_prenotare") || "da_prenotare") as ServiceStatus,
    supplier_id: String(formData.get("supplier_id") ?? "") || null,
    activity_id: String(formData.get("activity_id") ?? "") || null,
    net_cost: formData.get("net_cost") ? Number(formData.get("net_cost")) : null,
    sell_price: formData.get("sell_price") ? Number(formData.get("sell_price")) : null,
    confirmation_number: String(formData.get("confirmation_number") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

// Quando un Servizio collegato a un'attività riceve un numero di conferma,
// lo copia nel campo dettaglio corrispondente di quell'attività (es. "pnr"
// per un volo, "numero_conferma" per un alloggio) così l'itinerario mostra
// subito il dato reale, senza bisogno di ricopiarlo a mano. Copia solo il
// dato strutturato: nessun testo viene generato o modificato.
async function syncConfirmationToActivity(
  supabase: SupabaseServerClient,
  activityId: string | null,
  confirmationNumber: string | null,
) {
  if (!activityId || !confirmationNumber) return;

  try {
    const { data: activity } = await supabase
      .from("activities")
      .select("activity_type, details")
      .eq("id", activityId)
      .single();
    if (!activity) return;

    const key = confirmationDetailKey[activity.activity_type as Activity["activity_type"]];
    if (!key) return;

    await supabase
      .from("activities")
      .update({ details: { ...(activity.details ?? {}), [key]: confirmationNumber } })
      .eq("id", activityId);
  } catch {
    // Il servizio resta comunque salvato anche se la sincronizzazione fallisce.
  }
}

export async function addTripService(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const fields = readServiceFields(formData);
  if (!fields.title) return;

  const { count } = await supabase
    .from("trip_services")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  await supabase.from("trip_services").insert({ trip_id: tripId, service_order: count ?? 0, ...fields });
  await syncConfirmationToActivity(supabase, fields.activity_id, fields.confirmation_number);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function updateTripService(tripId: string, serviceId: string, formData: FormData) {
  const supabase = await createClient();
  const fields = readServiceFields(formData);
  if (!fields.title) return;

  await supabase.from("trip_services").update(fields).eq("id", serviceId);
  await syncConfirmationToActivity(supabase, fields.activity_id, fields.confirmation_number);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

export async function deleteTripService(tripId: string, serviceId: string) {
  const supabase = await createClient();
  await supabase.from("trip_services").delete().eq("id", serviceId);
  revalidatePath(`/dashboard/trips/${tripId}`);
}

// Scadenzario pagamenti: incassi dal cliente e pagamenti ai fornitori,
// con scadenza e data di incasso/pagamento effettivo. Stesso pannello
// "Servizi e fornitori", non obbligatorio, mai visibile al cliente.
function readPaymentFields(formData: FormData) {
  return {
    direction: (String(formData.get("direction") ?? "incasso") || "incasso") as PaymentDirection,
    service_id: String(formData.get("service_id") ?? "") || null,
    amount: Number(formData.get("amount") ?? 0),
    due_date: String(formData.get("due_date") ?? "") || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function addTripPayment(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const fields = readPaymentFields(formData);
  if (!fields.amount) return;

  await supabase.from("trip_payments").insert({ trip_id: tripId, ...fields });
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard");
}

export async function updateTripPayment(tripId: string, paymentId: string, formData: FormData) {
  const supabase = await createClient();
  const fields = readPaymentFields(formData);
  if (!fields.amount) return;

  await supabase.from("trip_payments").update(fields).eq("id", paymentId);
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard");
}

export async function toggleTripPaymentPaid(tripId: string, paymentId: string, paid: boolean) {
  const supabase = await createClient();
  await supabase
    .from("trip_payments")
    .update({ paid_date: paid ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", paymentId);
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard");
}

export async function deleteTripPayment(tripId: string, paymentId: string) {
  const supabase = await createClient();
  await supabase.from("trip_payments").delete().eq("id", paymentId);
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard");
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Genera un itinerario a partire da una bozza (testo incollato, e/o un file
// caricato: foto della bozza o foglio Excel/CSV) e lo inserisce come
// giorni/attività veri, pronti per essere rivisti e corretti dall'agenzia
// prima di passare a "finale". Pensata solo per un viaggio con itinerario
// ancora vuoto: fonderla con un itinerario già popolato è un rischio che
// rimandiamo a dopo.
export async function applyAiItineraryDraft(
  tripId: string,
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato." };

  let draftText = String(formData.get("draft_text") ?? "").trim();
  let image: DraftImage | null = null;

  const draftFile = formData.get("draft_file");
  if (draftFile instanceof File && draftFile.size > 0) {
    if (draftFile.type.startsWith("image/")) {
      const validationError = validateImageFile(draftFile);
      if (validationError) return { error: validationError };
      const buffer = Buffer.from(await draftFile.arrayBuffer());
      image = {
        base64: buffer.toString("base64"),
        mediaType: draftFile.type as DraftImage["mediaType"],
      };
    } else if (draftFile.name.toLowerCase().endsWith(".csv")) {
      const validationError = validateSpreadsheetFile(draftFile);
      if (validationError) return { error: validationError };
      const buffer = Buffer.from(await draftFile.arrayBuffer());
      draftText = [draftText, buffer.toString("utf-8")].filter(Boolean).join("\n\n");
    } else if (draftFile.name.toLowerCase().endsWith(".txt") || draftFile.name.toLowerCase().endsWith(".md")) {
      const validationError = validateTextFile(draftFile);
      if (validationError) return { error: validationError };
      const buffer = Buffer.from(await draftFile.arrayBuffer());
      draftText = [draftText, buffer.toString("utf-8")].filter(Boolean).join("\n\n");
    } else if (draftFile.name.toLowerCase().endsWith(".xlsx")) {
      const validationError = validateSpreadsheetFile(draftFile);
      if (validationError) return { error: validationError };
      const buffer = Buffer.from(await draftFile.arrayBuffer());
      let fileText: string;
      try {
        fileText = await parseExcelToText(buffer);
      } catch {
        return { error: "Non sono riuscito a leggere il file Excel. Controlla che sia un file .xlsx valido." };
      }
      draftText = [draftText, fileText].filter(Boolean).join("\n\n");
    } else {
      return {
        error:
          "Formato file non supportato: carica una foto (JPG/PNG), un file Excel (.xlsx), un .csv o un testo (.txt/.md).",
      };
    }
  }

  if (!draftText && !image) {
    return { error: "Incolla un testo, oppure carica un file Excel o una foto della bozza." };
  }

  const promptStyleId = String(formData.get("prompt_style_id") ?? "") || null;

  // Queste letture sono indipendenti tra loro: le facciamo in parallelo
  // invece che una dopo l'altra, per non sommare i tempi di andata/ritorno
  // al database (che è in un'altra regione rispetto al sito).
  const [{ data: styleRow }, { data: trip }, { data: existingDays }, { data: ownerTripRows }] =
    await Promise.all([
      promptStyleId
        ? supabase.from("prompt_styles").select("prompt_text").eq("id", promptStyleId).maybeSingle()
        : Promise.resolve({ data: null as { prompt_text: string } | null }),
      supabase.from("trips").select("*").eq("id", tripId).single(),
      supabase.from("trip_days").select("id").eq("trip_id", tripId),
      supabase.from("trips").select("id").eq("owner_id", user.id).neq("id", tripId).limit(10),
    ]);
  const styleInstructions = styleRow?.prompt_text ?? null;

  if (!trip) return { error: "Viaggio non trovato." };
  // Un viaggio creato con le date ha già i suoi giorni, ma vuoti: quelli si
  // possono sostituire. Si rifiuta solo se c'è già del contenuto da non
  // sovrascrivere.
  const existingDayIds = (existingDays || []).map((d) => d.id as string);
  if (existingDayIds.length > 0) {
    const { count: existingActivitiesCount } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .in("trip_day_id", existingDayIds);
    if ((existingActivitiesCount ?? 0) > 0) {
      return {
        error: "Questo viaggio ha già delle attività: la generazione AI è pensata solo per un itinerario vuoto.",
      };
    }
  }

  // Esempi di stile: alcune descrizioni scritte in passato da questa stessa
  // agenzia su altri viaggi, per far scrivere all'AI con un tono simile.
  const ownerTripIds = (ownerTripRows || []).map((t) => t.id);
  let styleExamples: string[] = [];
  if (ownerTripIds.length > 0) {
    const { data: ownerDayRows } = await supabase.from("trip_days").select("id").in("trip_id", ownerTripIds);
    const dayIds = (ownerDayRows || []).map((d) => d.id);
    if (dayIds.length > 0) {
      const { data: styleActs } = await supabase
        .from("activities")
        .select("description")
        .in("trip_day_id", dayIds)
        .not("description", "is", null)
        .limit(40);
      styleExamples = (styleActs || [])
        .map((a) => String(a.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
        .filter((text) => text.length > 40)
        .slice(0, 5);
    }
  }

  let generated;
  try {
    generated = await generateItineraryFromDraft({ draftText, styleExamples, styleInstructions, image });
  } catch {
    return { error: "L'AI non è riuscita a generare l'itinerario. Riprova, magari con un testo più chiaro." };
  }

  const sortedDays = [...generated.days].sort((a, b) => a.day_index - b.day_index);

  // Solo ora, a generazione riuscita, togliamo i giorni vuoti preesistenti:
  // se l'AI fallisce restano intatti.
  if (existingDayIds.length > 0) {
    await supabase.from("trip_days").delete().in("id", existingDayIds);
  }

  // Un solo inserimento per tutti i giorni, poi uno solo per tutte le
  // attività: molti giri di andata/ritorno al database in sequenza erano la
  // parte più lenta della generazione, molto più del tempo preso dall'AI.
  const { data: insertedDays } = await supabase
    .from("trip_days")
    .insert(
      sortedDays.map((day, dayOrder) => ({
        trip_id: tripId,
        day_order: dayOrder,
        day_date: trip.start_date ? addDaysToDate(trip.start_date, dayOrder) : null,
        title: day.title || null,
      })),
    )
    .select("id, day_order");

  const dayIdByOrder = new Map((insertedDays || []).map((d) => [d.day_order, d.id as string]));

  const activityRows: {
    trip_day_id: string;
    title: string;
    start_time: string | null;
    description: string | null;
    location: string | null;
    activity_type: ActivityType;
    details: Record<string, string>;
    activity_order: number;
  }[] = [];
  const lodgingChecks: { dayId: string; title: string; details: Record<string, string> }[] = [];

  sortedDays.forEach((day, dayOrder) => {
    const dayId = dayIdByOrder.get(dayOrder);
    if (!dayId) return;

    day.activities.forEach((activity, activityOrder) => {
      const activityType = activity.activity_type as ActivityType;
      const allowedKeys = new Set(detailFields[activityType].map((field) => field.key));
      const cleanDetails: Record<string, string> = {};
      for (const [key, value] of Object.entries(activity.details || {})) {
        if (allowedKeys.has(key) && typeof value === "string" && value.trim()) cleanDetails[key] = value.trim();
      }

      activityRows.push({
        trip_day_id: dayId,
        title: activity.title || "Attività",
        start_time: activity.start_time || null,
        description: activity.description || null,
        location: activity.location || null,
        activity_type: activityType,
        details: cleanDetails,
        activity_order: activityOrder,
      });

      if (activityType === "alloggio") {
        lodgingChecks.push({ dayId, title: activity.title || "Attività", details: cleanDetails });
      }
    });
  });

  if (activityRows.length > 0) {
    await supabase.from("activities").insert(activityRows);
  }

  // Effetto collaterale raro (solo se l'AI ha trovato una data di check-out
  // esplicita nella bozza): resta sequenziale perché può creare altri giorni.
  for (const check of lodgingChecks) {
    await handleLodgingCheckout(supabase, tripId, check.dayId, check.title, check.details);
  }

  revalidatePath(`/dashboard/trips/${tripId}`);
  return { error: null };
}
