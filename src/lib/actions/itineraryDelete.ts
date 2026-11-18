"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Eliminazione di attività e giorni: avviene SUBITO sul server (così non si perde mai, anche se si
// cambia giorno, si ricarica la pagina o si chiude il browser) e restituisce una "fotografia" di
// quello che è stato tolto. «Annulla» la rimette esattamente com'era: stessa attività, foto,
// documenti, collegamenti a servizi e messaggi.

type Row = Record<string, unknown>;
export type ActivitySnapshot = { activity: Row; photos: Row[]; documents: Row[]; serviceIds: string[]; messageIds: string[] };
export type DaySnapshot = { day: Row; activities: ActivitySnapshot[]; messageIds: string[] };

type Db = Awaited<ReturnType<typeof createClient>>;

async function ownedTrip(supabase: Db, tripId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("trips").select("id").eq("id", tripId).eq("owner_id", user.id).maybeSingle();
  return data ? user : null;
}

// Aggiorna inizio e fine del viaggio in base ai giorni con data che restano
async function syncTripDates(supabase: Db, tripId: string) {
  const { data: dated } = await supabase
    .from("trip_days")
    .select("day_date")
    .eq("trip_id", tripId)
    .not("day_date", "is", null)
    .order("day_date", { ascending: true });
  if (dated && dated.length > 0) {
    await supabase.from("trips").update({ start_date: dated[0].day_date, end_date: dated[dated.length - 1].day_date }).eq("id", tripId);
  }
}

async function snapshotActivities(supabase: Db, activities: Row[]): Promise<ActivitySnapshot[]> {
  const ids = activities.map((a) => String(a.id));
  if (ids.length === 0) return [];
  const [photos, documents, services, messages] = await Promise.all([
    supabase.from("activity_photos").select("*").in("activity_id", ids),
    supabase.from("documents").select("*").in("activity_id", ids),
    supabase.from("trip_services").select("id, activity_id").in("activity_id", ids),
    // La colonna activity_id dei messaggi esiste solo dopo la migrazione 0037: se manca si ignora
    supabase.from("trip_messages").select("id, activity_id").in("activity_id", ids),
  ]);
  return activities.map((activity) => {
    const id = String(activity.id);
    return {
      activity,
      photos: ((photos.data as Row[]) ?? []).filter((p) => p.activity_id === id),
      documents: ((documents.data as Row[]) ?? []).filter((d) => d.activity_id === id),
      serviceIds: ((services.data as Row[]) ?? []).filter((s) => s.activity_id === id).map((s) => String(s.id)),
      messageIds: messages.error ? [] : ((messages.data as Row[]) ?? []).filter((m) => m.activity_id === id).map((m) => String(m.id)),
    };
  });
}

async function restoreActivities(supabase: Db, snapshots: ActivitySnapshot[]): Promise<boolean> {
  if (snapshots.length === 0) return true;
  const { error } = await supabase.from("activities").upsert(snapshots.map((s) => s.activity), { onConflict: "id" });
  if (error) {
    console.error("[restore] attività:", error.message);
    return false;
  }
  const photos = snapshots.flatMap((s) => s.photos);
  const documents = snapshots.flatMap((s) => s.documents);
  const results = await Promise.all([
    photos.length ? supabase.from("activity_photos").upsert(photos, { onConflict: "id" }) : null,
    documents.length ? supabase.from("documents").upsert(documents, { onConflict: "id" }) : null,
    ...snapshots.flatMap((s) => [
      s.serviceIds.length ? supabase.from("trip_services").update({ activity_id: s.activity.id }).in("id", s.serviceIds) : null,
      s.messageIds.length ? supabase.from("trip_messages").update({ activity_id: s.activity.id }).in("id", s.messageIds) : null,
    ]),
  ]);
  for (const r of results) if (r?.error) console.error("[restore] collegamenti:", r.error.message);
  return true;
}

// ── Attività ─────────────────────────────────────────────────────────────

export async function deleteActivityNow(
  tripId: string,
  activityId: string,
): Promise<{ ok: true; snapshot: ActivitySnapshot } | { error: string }> {
  const supabase = await createClient();
  if (!(await ownedTrip(supabase, tripId))) return { error: "Sessione scaduta: ricarica la pagina e accedi di nuovo." };

  const { data: activity } = await supabase.from("activities").select("*").eq("id", activityId).maybeSingle();
  if (!activity) return { error: "Attività non trovata: forse è già stata eliminata." };
  const { data: day } = await supabase.from("trip_days").select("id").eq("id", activity.trip_day_id).eq("trip_id", tripId).maybeSingle();
  if (!day) return { error: "Attività non trovata in questo viaggio." };

  const [snapshot] = await snapshotActivities(supabase, [activity as Row]);
  const { error } = await supabase.from("activities").delete().eq("id", activityId);
  if (error) {
    console.error("[deleteActivityNow]", error.message);
    return { error: "Non è stato possibile eliminare l'attività. Riprova." };
  }
  revalidatePath(`/dashboard/trips/${tripId}`);
  return { ok: true, snapshot };
}

const RowSchema = z.record(z.string(), z.unknown());
const ActivitySnapshotSchema = z.object({
  activity: RowSchema,
  photos: z.array(RowSchema),
  documents: z.array(RowSchema),
  serviceIds: z.array(z.string().uuid()),
  messageIds: z.array(z.string().uuid()),
});
const uuid = z.string().uuid();

// Controlla che la fotografia riguardi davvero questo viaggio (i giorni devono essere suoi)
function consistent(s: z.infer<typeof ActivitySnapshotSchema>, allowedDayIds: Set<string>) {
  const id = s.activity.id;
  return (
    uuid.safeParse(id).success &&
    allowedDayIds.has(String(s.activity.trip_day_id)) &&
    s.photos.every((p) => p.activity_id === id) &&
    s.documents.every((d) => d.activity_id === id)
  );
}

export async function restoreActivity(tripId: string, snapshot: ActivitySnapshot): Promise<{ ok: true } | { error: string }> {
  const parsed = ActivitySnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return { error: "Non è stato possibile annullare." };
  const supabase = await createClient();
  if (!(await ownedTrip(supabase, tripId))) return { error: "Sessione scaduta: ricarica la pagina." };

  const { data: days } = await supabase.from("trip_days").select("id").eq("trip_id", tripId);
  const allowed = new Set((days ?? []).map((d) => String(d.id)));
  if (!consistent(parsed.data, allowed) || parsed.data.documents.some((d) => d.trip_id !== tripId)) {
    return { error: "Non è stato possibile annullare: il giorno di questa attività non esiste più." };
  }
  const ok = await restoreActivities(supabase, [parsed.data as ActivitySnapshot]);
  revalidatePath(`/dashboard/trips/${tripId}`);
  return ok ? { ok: true } : { error: "Non è stato possibile annullare. Riprova." };
}

// ── Giorni ───────────────────────────────────────────────────────────────

export async function deleteDayNow(tripId: string, dayId: string): Promise<{ ok: true; snapshot: DaySnapshot } | { error: string }> {
  const supabase = await createClient();
  if (!(await ownedTrip(supabase, tripId))) return { error: "Sessione scaduta: ricarica la pagina e accedi di nuovo." };

  const { data: day } = await supabase.from("trip_days").select("*").eq("id", dayId).eq("trip_id", tripId).maybeSingle();
  if (!day) return { error: "Giorno non trovato: forse è già stato eliminato." };

  const [{ data: activities }, messages] = await Promise.all([
    supabase.from("activities").select("*").eq("trip_day_id", dayId),
    supabase.from("trip_messages").select("id").eq("day_id", dayId),
  ]);
  const snapshot: DaySnapshot = {
    day: day as Row,
    activities: await snapshotActivities(supabase, (activities as Row[]) ?? []),
    messageIds: messages.error ? [] : ((messages.data as Row[]) ?? []).map((m) => String(m.id)),
  };

  const { error } = await supabase.from("trip_days").delete().eq("id", dayId);
  if (error) {
    console.error("[deleteDayNow]", error.message);
    return { error: "Non è stato possibile eliminare il giorno. Riprova." };
  }
  await syncTripDates(supabase, tripId);
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard/trips");
  return { ok: true, snapshot };
}

const DaySnapshotSchema = z.object({
  day: RowSchema,
  activities: z.array(ActivitySnapshotSchema),
  messageIds: z.array(z.string().uuid()),
});

export async function restoreDay(tripId: string, snapshot: DaySnapshot): Promise<{ ok: true } | { error: string }> {
  const parsed = DaySnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return { error: "Non è stato possibile annullare." };
  const supabase = await createClient();
  if (!(await ownedTrip(supabase, tripId))) return { error: "Sessione scaduta: ricarica la pagina." };

  const day = parsed.data.day;
  if (!uuid.safeParse(day.id).success || day.trip_id !== tripId) return { error: "Non è stato possibile annullare." };
  const allowed = new Set([String(day.id)]);
  if (!parsed.data.activities.every((a) => consistent(a, allowed) && a.documents.every((d) => d.trip_id === tripId))) {
    return { error: "Non è stato possibile annullare." };
  }

  const { error } = await supabase.from("trip_days").upsert(day, { onConflict: "id" });
  if (error) {
    console.error("[restoreDay]", error.message);
    return { error: "Non è stato possibile annullare. Riprova." };
  }
  await restoreActivities(supabase, parsed.data.activities as ActivitySnapshot[]);
  if (parsed.data.messageIds.length) await supabase.from("trip_messages").update({ day_id: day.id }).in("id", parsed.data.messageIds);
  await syncTripDates(supabase, tripId);
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath("/dashboard/trips");
  return { ok: true };
}
