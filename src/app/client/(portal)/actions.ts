"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encryptField } from "@/lib/encryption";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";

export async function clientSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/clienti");
}

// Avvisa l'agenzia anche via notifica push (oltre al messaggio WhatsApp che
// il cliente invia direttamente): utile come canale di riserva se il
// telefono dell'agenzia è silenzioso. Non fa fallire nulla lato cliente se
// l'invio push non va a buon fine.
export async function notifyEmergencyPush(tripId: string, tripTitle: string) {
  const supabase = await createClient();
  const { data: targets } = await supabase.rpc("get_emergency_push_targets", { p_trip_id: tripId });

  const typedTargets = (targets as PushTarget[]) || [];
  if (typedTargets.length === 0) return;

  const { expiredEndpoints } = await sendPushToTargets(typedTargets, {
    title: "Emergenza segnalata",
    body: `Un cliente ha premuto il tasto emergenza per "${tripTitle}".`,
    url: "/dashboard",
  });

  if (expiredEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
  }
}

// Permette al cliente di compilare/aggiornare i propri dati anagrafici e
// documenti (gli stessi campi che l'agenzia può inserire dalla sua
// anagrafica clienti). Passa sempre per la RPC dedicata, mai per un update
// diretto sulla tabella: così non può toccare altri campi della scheda.
export async function updateClientTravelDocuments(clientId: string, formData: FormData) {
  const supabase = await createClient();

  const field = (name: string) => String(formData.get(name) ?? "").trim() || null;

  await supabase.rpc("update_client_travel_documents", {
    p_client_id: clientId,
    p_date_of_birth: encryptField(field("date_of_birth")),
    p_place_of_birth: encryptField(field("place_of_birth")),
    p_nationality: encryptField(field("nationality")),
    p_fiscal_code: encryptField(field("fiscal_code")),
    p_residence_address: encryptField(field("residence_address")),
    p_id_card_number: encryptField(field("id_card_number")),
    p_id_card_expiry: encryptField(field("id_card_expiry")),
    p_passport_number: encryptField(field("passport_number")),
    p_passport_expiry: encryptField(field("passport_expiry")),
  });

  revalidatePath("/client/documenti");
}

// «Chiedi un preventivo» dal suggerimento del prossimo viaggio: arriva all'agenzia come richiesta
export async function requestQuote(title: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_request_quote", {
    p_title: String(title).slice(0, 200),
    p_message: String(message ?? "").slice(0, 600),
  });
  if (error) return { ok: false, error: "Non è stato possibile inviare la richiesta: riprova più tardi o scrivi alla tua agenzia." };
  if (data !== true) return { ok: false, error: "Hai già inviato diverse richieste oggi: la tua agenzia ti risponderà presto." };
  return { ok: true };
}
