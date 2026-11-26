"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendMail } from "@/lib/email";
import { areaHosts, areaHref, CLIENT_LOGIN } from "@/lib/areas";
import { buildConfirmEmail } from "@/lib/rotta";

export type ReminderResult = { ok: true; email: string } | { error: string };

// L'agenzia chiede al cliente di confermare il viaggio (una volta sola per viaggio, solo se è «in attesa»)
export async function sendConfirmationReminder(tripId: string): Promise<ReminderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };

  const { data, error } = await supabase.rpc("rotta_claim_reminder", { p_trip: tripId });
  if (error) return { error: "Non è stato possibile preparare il promemoria. Riprova tra poco." };
  const row = (data as { client_email: string; client_name: string; trip_title: string; agency_name: string; agency_email: string | null }[] | null)?.[0];
  if (!row) return { error: "Il promemoria è già stato inviato per questo viaggio, oppure il viaggio non è più in attesa." };

  const host = (await headers()).get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const next = "?next=/client";
  const link = areaHosts() ? areaHref("client", `${CLIENT_LOGIN}${next}`) : `${protocol}://${host}${CLIENT_LOGIN}${next}`;

  const mail = buildConfirmEmail({ clientName: row.client_name, agencyName: row.agency_name || "La tua agenzia di viaggi", title: row.trip_title, link });
  const result = await sendMail({ to: row.client_email, ...mail, replyTo: row.agency_email, fromName: row.agency_name || null });
  if (!result.ok) {
    await supabase.rpc("rotta_release_reminder", { p_trip: tripId }); // si potrà riprovare
    const messages: Record<string, string> = {
      not_configured: "L'invio delle mail non è ancora attivo: manca la chiave RESEND_API_KEY su Vercel.",
      rejected: "Il servizio di posta ha rifiutato l'invio: controlla la chiave e il mittente su Resend.",
      invalid: "Il servizio di posta non accetta il mittente: verifica il dominio su Resend.",
      failed: "Non è stato possibile inviare la mail. Riprova tra poco.",
    };
    return { error: messages[result.error] ?? messages.failed };
  }
  revalidatePath("/dashboard/sconto");
  return { ok: true, email: row.client_email };
}
