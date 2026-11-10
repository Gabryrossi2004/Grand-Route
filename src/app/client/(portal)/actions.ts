"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";

export async function clientSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/client/login");
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
