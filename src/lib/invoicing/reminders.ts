import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/email";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";

type Target = {
  invoice_id: string;
  number: string;
  issue_date: string;
  due_date: string;
  days_overdue: number;
  stage: number;
  residuo: number;
  currency: string;
  seller_id: string;
  seller_name: string;
  seller_email: string | null;
  buyer_id: string;
  buyer_email: string;
};

const it = (d: string) => d.split("-").reverse().join("/");
const esc = (t: string) => t.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);

// Solleciti automatici: 1, 7, 15 e 30 giorni dopo la scadenza, solo per l'importo ancora da pagare.
// Al cliente: email (risposta al fornitore) e notifica; al fornitore: una notifica che il sollecito è partito.
export async function sendInvoiceReminders(supabase: SupabaseClient, secret: string): Promise<number> {
  const { data, error } = await supabase.rpc("network_invoice_reminder_targets", { p_secret: secret });
  if (error) {
    if (!/function|does not exist|schema cache/i.test(error.message)) console.error("[cron] solleciti fatture:", error.message);
    return 0;
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://grandroute.it";
  let sent = 0;
  for (const t of (data ?? []) as Target[]) {
    if (!(Number(t.residuo) > 0)) {
      await supabase.rpc("network_invoice_mark_reminded", { p_secret: secret, p_id: t.invoice_id, p_stage: t.stage });
      continue;
    }
    const amount = `${Number(t.residuo).toFixed(2).replace(".", ",")} ${t.currency}`;
    const link = `${site}/dashboard/ordini/fatture/${t.invoice_id}`;
    const tone = t.stage >= 3 ? "Secondo i nostri dati" : "Ti ricordiamo che";
    const text =
      `${tone} la fattura n. ${t.number} del ${it(t.issue_date)} di ${t.seller_name}, scaduta il ${it(t.due_date)}, risulta ancora da pagare: ${amount}.\n` +
      `Se hai già pagato, segnala la fattura come pagata su Grand Route (così il sollecito non arriva più). Per qualsiasi dubbio rispondi a questa email: arriva direttamente al fornitore.`;
    const mail = await sendMail({
      to: t.buyer_email,
      subject: `Sollecito di pagamento – fattura n. ${t.number} del ${it(t.issue_date)} (${t.seller_name})`,
      text: `${text}\n\nApri la fattura: ${link}`,
      html: `<p>${esc(text).replace(/\n/g, "<br>")}</p><p><a href="${link}">Apri la fattura su Grand Route</a></p>`,
      replyTo: t.seller_email,
      fromName: `${t.seller_name} via Grand Route`,
    });
    const { data: buyerTargets } = await supabase.rpc("network_user_push_targets", { p_secret: secret, p_user: t.buyer_id });
    if ((buyerTargets as PushTarget[] | null)?.length)
      await sendPushToTargets(buyerTargets as PushTarget[], { title: "Fattura scaduta", body: `Fattura ${t.number} di ${t.seller_name}: ${amount} da pagare`, url: `/dashboard/ordini/fatture/${t.invoice_id}` });
    const { data: sellerTargets } = await supabase.rpc("network_user_push_targets", { p_secret: secret, p_user: t.seller_id });
    if ((sellerTargets as PushTarget[] | null)?.length)
      await sendPushToTargets(sellerTargets as PushTarget[], { title: "Sollecito inviato", body: `Fattura ${t.number}: scaduta da ${t.days_overdue} giorni, ${amount}`, url: `/rete/fatture/${t.invoice_id}` });
    // si segna anche se l'email non parte (es. servizio email non configurato), per non ripetere ogni giorno
    await supabase.rpc("network_invoice_mark_reminded", { p_secret: secret, p_id: t.invoice_id, p_stage: t.stage });
    if (mail.ok) sent++;
  }
  return sent;
}
