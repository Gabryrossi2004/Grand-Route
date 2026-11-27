"use server";

import { areaHosts, areaHref, CLIENT_LOGIN } from "@/lib/areas";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/email";
import { buildTripEmail } from "@/lib/tripEmail";
import { companyIdOf } from "@/lib/team";

export type SendTripResult = { ok: true; email: string; at: string } | { error: string };

const COOLDOWN_MS = 30_000;

// Invia per mail al cliente il link del viaggio pubblicato. Parte solo quando
// l'agenzia preme il pulsante e conferma (non in automatico alla pubblicazione).
export async function sendTripToClient(tripId: string): Promise<SendTripResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);

  // Solo il proprietario del viaggio può inviarlo
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).eq("owner_id", companyId).maybeSingle();
  if (!trip) return { error: "Viaggio non trovato." };
  if (!trip.is_published) return { error: "Pubblica prima il viaggio, poi invialo al cliente." };
  if (!trip.client_id) return { error: "Collega prima un cliente a questo viaggio." };

  const { data: client } = await supabase.from("clients").select("full_name, email").eq("id", trip.client_id).maybeSingle();
  const email = String(client?.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Il cliente non ha un indirizzo email valido: aggiungilo nella sua scheda." };

  const last = trip.client_notified_at ? new Date(trip.client_notified_at).getTime() : 0;
  if (Date.now() - last < COOLDOWN_MS) return { error: "Hai appena inviato questo viaggio: aspetta qualche secondo." };

  const { data: profile } = await supabase.from("profiles").select("agency_name, email").eq("id", companyId).maybeSingle();
  const agencyName = profile?.agency_name?.trim() || "La tua agenzia di viaggi";

  const host = (await headers()).get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const mail = buildTripEmail({
    clientName: client?.full_name ?? "",
    agencyName,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    link: `${origin}/t/${trip.public_slug}`,
    clientAreaLink: areaHosts() ? areaHref("client", CLIENT_LOGIN) : `${origin}${CLIENT_LOGIN}`,
  });

  const result = await sendMail({ to: email, ...mail, replyTo: profile?.email ?? null, fromName: agencyName });
  if (!result.ok) {
    const messages: Record<string, string> = {
      not_configured: "L'invio delle mail non è ancora attivo: manca la chiave RESEND_API_KEY su Vercel.",
      rejected: "Il servizio di posta ha rifiutato l'invio: controlla la chiave e il mittente su Resend.",
      invalid: "Il servizio di posta non accetta il mittente: verifica il dominio su Resend.",
      failed: "Non è stato possibile inviare la mail. Riprova tra poco.",
    };
    return { error: messages[result.error] ?? messages.failed };
  }

  const at = new Date().toISOString();
  // Se lo script 0042 non è stato eseguito, l'aggiornamento fallisce in silenzio: la mail è comunque partita.
  const { error: markError } = await supabase.from("trips").update({ client_notified_at: at }).eq("id", tripId);
  if (markError) console.error("[sendTripToClient] segno invio:", markError.message);

  revalidatePath(`/dashboard/trips/${tripId}`);
  return { ok: true, email, at };
}
