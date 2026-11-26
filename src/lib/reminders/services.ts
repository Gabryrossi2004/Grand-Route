import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/email";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";
import { bodyToHtml, buildReminder, type ReminderService } from "@/lib/reminders/template";

type Target = {
  seller_id: string;
  seller_name: string;
  seller_email: string | null;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  services: ReminderService[];
  tpl_subject: string | null;
  tpl_intro: string | null;
  tpl_outro: string | null;
};

const site = () => process.env.NEXT_PUBLIC_SITE_URL || "https://grandroute.it";
const romeToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// Invia l'email di riconferma del fornitore all'agenzia: a nome del fornitore, le risposte arrivano a lui
export async function deliverReminder(p: { to: string; subject: string; body: string; sellerId: string; sellerName: string; sellerEmail: string | null }) {
  const link = `${site()}/rete/posta/nuovo?a=${p.sellerId}`;
  return sendMail({
    to: p.to,
    subject: p.subject,
    text: `${p.body}\n\nRispondi su Grand Route: ${link}`,
    html: bodyToHtml(p.body, { url: link, label: "Rispondi su Grand Route" }),
    replyTo: p.sellerEmail,
    fromName: `${p.sellerName} via Grand Route`,
  });
}

// Promemoria della sera prima, chiamato dall'attività programmata dopo le 16:00.
// - Modalità automatica: una email in blocco per ogni agenzia che non ha riconfermato (testo del fornitore o standard).
// - Modalità «lo rivedo io»: nessuna email, ma un avviso al fornitore, che trova le bozze nella sua Agenda.
export async function sendServiceReminders(
  supabase: SupabaseClient,
  secret: string,
): Promise<{ agencies: number; services: number; emails: number; notices: number }> {
  const out = { agencies: 0, services: 0, emails: 0, notices: 0 };
  const { data, error } = await supabase.rpc("network_service_reminder_targets", { p_secret: secret });
  if (error) {
    if (!/function|does not exist|schema cache/i.test(error.message)) console.error("[cron] promemoria servizi:", error.message);
    return out;
  }
  const today = romeToday();
  for (const t of (data ?? []) as Target[]) {
    out.agencies++;
    out.services += t.services.length;
    const mail = buildReminder({ seller: t.seller_name, buyer: t.buyer_name, today }, t.services, { subject: t.tpl_subject, intro: t.tpl_intro, outro: t.tpl_outro });
    const sent = await deliverReminder({ to: t.buyer_email, subject: mail.subject, body: mail.body, sellerId: t.seller_id, sellerName: t.seller_name, sellerEmail: t.seller_email });
    if (sent.ok) out.emails++;
    else console.error("[cron] promemoria servizi: email non inviata a", t.buyer_id, sent.error);
    const n = t.services.length;
    const { data: buyerTargets } = await supabase.rpc("network_user_push_targets", { p_secret: secret, p_user: t.buyer_id });
    if ((buyerTargets as PushTarget[] | null)?.length)
      await sendPushToTargets(buyerTargets as PushTarget[], {
        title: "Riconferma dei servizi",
        body: `${t.seller_name} chiede di riconfermare ${n} ${n === 1 ? "servizio" : "servizi"}: guarda la tua email`,
        url: "/rete/posta",
      });
    const { data: sellerTargets } = await supabase.rpc("network_user_push_targets", { p_secret: secret, p_user: t.seller_id });
    if ((sellerTargets as PushTarget[] | null)?.length)
      await sendPushToTargets(sellerTargets as PushTarget[], {
        title: "Promemoria inviato",
        body: `${t.buyer_name} non aveva ancora riconfermato: email con ${n} ${n === 1 ? "servizio" : "servizi"} inviata a tuo nome`,
        url: "/rete/agenda",
      });
  }

  // fornitori in modalità «lo rivedo io»: un avviso al giorno
  const { data: notices } = await supabase.rpc("network_service_reminder_manual_targets", { p_secret: secret });
  for (const n of (notices ?? []) as { seller_id: string; agencies: number; services: number }[]) {
    const { data: sellerTargets } = await supabase.rpc("network_user_push_targets", { p_secret: secret, p_user: n.seller_id });
    if ((sellerTargets as PushTarget[] | null)?.length) {
      await sendPushToTargets(sellerTargets as PushTarget[], {
        title: "Riconferme da chiedere",
        body: `${n.agencies} ${n.agencies === 1 ? "agenzia non ha" : "agenzie non hanno"} ancora riconfermato (${n.services} ${n.services === 1 ? "servizio" : "servizi"}): rivedi e invia le email`,
        url: "/rete/agenda",
      });
      out.notices++;
    }
  }
  return out;
}
