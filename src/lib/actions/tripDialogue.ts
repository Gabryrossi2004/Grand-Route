"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPushToTargets } from "@/lib/webpush";

type Result = { ok: true } | { error: string };

const MAX_BODY = 2000;
const GENERIC_ERROR = "Non è stato possibile inviare. Riprova tra poco.";

type PushRow = { endpoint: string; p256dh: string; auth_key: string; recipient_role: "agency" | "client" };

// Avvisa l'altra parte via notifica push (se ha attivato le notifiche).
// Non fa mai fallire l'invio del messaggio.
async function notifyOtherParty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  title: string,
  body: string,
) {
  try {
    const { data } = await supabase.rpc("get_trip_message_push_targets", { p_trip_id: tripId });
    const targets = (data as PushRow[] | null) ?? [];
    if (targets.length === 0) return;
    const url = targets[0].recipient_role === "client" ? `/client/trips/${tripId}` : `/dashboard/trips/${tripId}`;
    const { expiredEndpoints } = await sendPushToTargets(targets, { title, body: body.slice(0, 140), url });
    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }
  } catch (error) {
    console.error("[tripDialogue] notifica non inviata:", error);
  }
}

type Db = Awaited<ReturnType<typeof createClient>>;

// L'errore tipico quando il database non ha ancora l'aggiornamento 0037
// (colonna o parametro "activity" mancante): in quel caso si procede lo stesso,
// scrivendo il nome dell'attività nel testo.
function isMissingActivitySupport(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /activity_id|p_activity_id|schema cache/i.test(error.message ?? "")
  );
}

async function withActivityName(supabase: Db, activityId: string, text: string) {
  const { data } = await supabase.from("activities").select("title").eq("id", activityId).maybeSingle();
  return data?.title ? `[${data.title}] ${text}` : text;
}

// Messaggi più chiari per gli errori più comuni
function errorMessageFor(error: { code?: string; message?: string }) {
  if (error.code === "PGRST202" || /function .* schema cache/i.test(error.message ?? "")) {
    return "Manca un aggiornamento del database (script 0036 o 0037). Avvisa la tua agenzia.";
  }
  if (/non autorizzato/i.test(error.message ?? "")) return "Non risulti collegato a questo viaggio.";
  return GENERIC_ERROR;
}

function refresh(tripId: string) {
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath(`/client/trips/${tripId}`);
}

async function currentRole(supabase: Awaited<ReturnType<typeof createClient>>, tripId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: trip } = await supabase.from("trips").select("owner_id, title").eq("id", tripId).maybeSingle();
  if (!trip) return null;
  return { user, title: trip.title as string, role: (trip.owner_id === user.id ? "agency" : "client") as "agency" | "client" };
}

export async function sendTripMessage(
  tripId: string,
  body: string,
  dayId?: string | null,
  activityId?: string | null,
): Promise<Result> {
  const text = body.trim();
  if (!text) return { error: "Scrivi un messaggio." };
  if (text.length > MAX_BODY) return { error: `Il messaggio è troppo lungo (massimo ${MAX_BODY} caratteri).` };

  const supabase = await createClient();
  const who = await currentRole(supabase, tripId);
  if (!who) return { error: "Sessione scaduta: accedi di nuovo." };

  const row = {
    trip_id: tripId,
    author_id: who.user.id,
    author_role: who.role,
    kind: "message" as const,
    body: text,
    day_id: dayId || null,
  };
  // activity_id solo se indicata: prima della migrazione 0037 la colonna non esiste
  const payload: Record<string, unknown> = activityId ? { ...row, activity_id: activityId } : row;
  let { error } = await supabase.from("trip_messages").insert(payload);
  if (error && activityId && isMissingActivitySupport(error)) {
    ({ error } = await supabase
      .from("trip_messages")
      .insert({ ...row, body: (await withActivityName(supabase, activityId, text)).slice(0, MAX_BODY) }));
  }
  if (error) {
    console.error("[sendTripMessage]", error.code, error.message);
    return { error: GENERIC_ERROR };
  }

  await notifyOtherParty(
    supabase,
    tripId,
    who.role === "agency" ? "Nuovo messaggio dalla tua agenzia" : "Nuovo messaggio da un cliente",
    `${who.title}: ${text}`,
  );
  refresh(tripId);
  return { ok: true };
}

// Il cliente approva l'itinerario.
export async function approveTrip(tripId: string): Promise<Result> {
  const supabase = await createClient();
  const who = await currentRole(supabase, tripId);
  if (!who) return { error: "Sessione scaduta: accedi di nuovo." };

  const { error } = await supabase.rpc("client_set_trip_approval", { p_trip_id: tripId, p_status: "approved" });
  if (error) {
    console.error("[approveTrip]", error.code, error.message);
    return { error: errorMessageFor(error) };
  }
  await notifyOtherParty(supabase, tripId, "Itinerario approvato", `Il cliente ha approvato "${who.title}".`);
  refresh(tripId);
  return { ok: true };
}

// Il cliente chiede modifiche (con una nota, e se vuole un giorno preciso).
export async function requestTripChanges(
  tripId: string,
  note: string,
  dayId?: string | null,
  activityId?: string | null,
): Promise<Result> {
  const text = note.trim();
  if (!text) return { error: "Descrivi cosa vuoi cambiare." };
  if (text.length > MAX_BODY) return { error: `Il testo è troppo lungo (massimo ${MAX_BODY} caratteri).` };

  const supabase = await createClient();
  const who = await currentRole(supabase, tripId);
  if (!who) return { error: "Sessione scaduta: accedi di nuovo." };

  const args = {
    p_trip_id: tripId,
    p_status: "changes_requested",
    p_note: text,
    p_day_id: dayId || null,
  };
  let { error } = await supabase.rpc("client_set_trip_approval", activityId ? { ...args, p_activity_id: activityId } : args);
  if (error && activityId && isMissingActivitySupport(error)) {
    ({ error } = await supabase.rpc("client_set_trip_approval", {
      ...args,
      p_note: (await withActivityName(supabase, activityId, text)).slice(0, MAX_BODY),
    }));
  }
  if (error) {
    console.error("[requestTripChanges]", error.code, error.message);
    return { error: errorMessageFor(error) };
  }
  await notifyOtherParty(supabase, tripId, "Richiesta di modifiche", `${who.title}: ${text}`);
  refresh(tripId);
  return { ok: true };
}

// L'agenzia manda l'itinerario al cliente per l'approvazione.
export async function sendTripForApproval(tripId: string): Promise<Result> {
  const supabase = await createClient();
  const who = await currentRole(supabase, tripId);
  if (!who || who.role !== "agency") return { error: "Sessione scaduta: accedi di nuovo." };

  const { data: trip } = await supabase.from("trips").select("client_id").eq("id", tripId).maybeSingle();
  if (!trip?.client_id) return { error: "Collega prima un cliente a questo viaggio." };
  const { data: client } = await supabase.from("clients").select("user_id").eq("id", trip.client_id).maybeSingle();
  if (!client?.user_id) {
    return { error: "Il cliente non ha ancora un account nell'area clienti: invitalo a registrarsi." };
  }

  const { error: updateError } = await supabase
    .from("trips")
    .update({ approval_status: "pending", approval_updated_at: new Date().toISOString() })
    .eq("id", tripId);
  if (updateError) {
    console.error("[sendTripForApproval]", updateError.message);
    return { error: GENERIC_ERROR };
  }

  await supabase.from("trip_messages").insert({
    trip_id: tripId,
    author_id: who.user.id,
    author_role: "agency",
    kind: "sent_for_approval",
    body: "Ti ho inviato l'itinerario: guardalo con calma e poi approvalo, oppure chiedimi le modifiche.",
  });
  await notifyOtherParty(supabase, tripId, "Il tuo itinerario è pronto", `Guarda "${who.title}" e dai la tua approvazione.`);
  refresh(tripId);
  return { ok: true };
}

export async function markTripMessagesRead(tripId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_trip_messages_read", { p_trip_id: tripId });
}
