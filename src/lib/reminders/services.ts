import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/email";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";

export type ReminderService = {
  id: string;
  date: string;
  time: string | null;
  title: string;
  place: string | null;
  pax: number | null;
  lead_name: string | null;
  reference: string | null;
  quantity: number;
  unit: string;
  amount: number;
  currency: string;
};

type Target = {
  seller_id: string;
  seller_name: string;
  seller_email: string | null;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  services: ReminderService[];
};

const esc = (t: string) => t.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string);
const dayName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dayShort = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", timeZone: "UTC" });
const money = (n: number, c: string) => {
  try {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: c }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c}`;
  }
};

// Testo dell'email di riconferma: tutti i servizi dell'agenzia, raggruppati per giorno e in ordine di orario
export function reminderContent(t: Pick<Target, "seller_name" | "buyer_name" | "services">, link: string) {
  const days = [...new Set(t.services.map((s) => s.date))];
  const when = days.length === 1 ? `di ${dayName(days[0])}` : `di ${days.map((d) => dayShort(d)).join(", ").replace(/, ([^,]*)$/, " e $1")}`;
  const subject = `Riconferma servizi ${days.length === 1 ? "di domani" : "dei prossimi giorni"} – ${t.seller_name}`;
  const intro = `Buonasera ${t.buyer_name},\nqui ${t.seller_name}: questi sono i servizi che abbiamo in programma ${when}. Ci confermi che è tutto ancora valido?`;
  const outro = `Per riconfermare basta un tocco su Grand Route (link qui sotto), oppure rispondi a questa email. Se qualcosa è cambiato, scrivici subito.`;

  const line = (s: ReminderService) => {
    const bits = [s.time ? `ore ${s.time}` : "orario da definire", s.title];
    const extra = [s.place, s.pax ? `${s.pax} ${s.pax === 1 ? "persona" : "persone"}` : null, s.lead_name ? `rif. ${s.lead_name}` : s.reference ? `rif. ${s.reference}` : null].filter(Boolean);
    return { head: bits.join(" – "), extra: extra.join(" · "), price: money(s.amount, s.currency) };
  };

  const text =
    `${intro}\n\n` +
    days
      .map((d) => `${dayName(d).toUpperCase()}\n` + t.services.filter((s) => s.date === d).map((s) => { const l = line(s); return `• ${l.head}${l.extra ? `\n  ${l.extra}` : ""}\n  ${l.price} + IVA`; }).join("\n"))
      .join("\n\n") +
    `\n\n${outro}\n\nRiconferma i servizi: ${link}`;

  const html =
    `<p>${esc(intro).replace(/\n/g, "<br>")}</p>` +
    days
      .map(
        (d) =>
          `<p style="margin:16px 0 4px;font-weight:600;text-transform:capitalize">${esc(dayName(d))}</p><ul style="margin:0;padding-left:18px">` +
          t.services
            .filter((s) => s.date === d)
            .map((s) => {
              const l = line(s);
              return `<li style="margin:6px 0"><strong>${esc(l.head)}</strong>${l.extra ? `<br><span style="color:#555">${esc(l.extra)}</span>` : ""}<br><span style="color:#555">${esc(l.price)} + IVA</span></li>`;
            })
            .join("") +
          `</ul>`,
      )
      .join("") +
    `<p style="margin-top:18px">${esc(outro)}</p>` +
    `<p><a href="${link}" style="display:inline-block;background:#233c5e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Riconferma i servizi</a></p>`;
  return { subject, text, html };
}

// Promemoria automatico della sera prima: chiamato dall'attività programmata dopo le 16:00.
// La funzione del database sceglie solo le agenzie che non hanno ancora riconfermato (e segna l'invio una volta sola).
export async function sendServiceReminders(supabase: SupabaseClient, secret: string): Promise<{ agencies: number; services: number; emails: number }> {
  const { data, error } = await supabase.rpc("network_service_reminder_targets", { p_secret: secret });
  if (error) {
    if (!/function|does not exist|schema cache/i.test(error.message)) console.error("[cron] promemoria servizi:", error.message);
    return { agencies: 0, services: 0, emails: 0 };
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://grandroute.it";
  const link = `${site}/rete/riconferme`;
  let emails = 0;
  let services = 0;
  const rows = (data ?? []) as Target[];
  for (const t of rows) {
    services += t.services.length;
    const mail = reminderContent(t, link);
    const sent = await sendMail({
      to: t.buyer_email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: t.seller_email,
      fromName: `${t.seller_name} via Grand Route`,
    });
    if (sent.ok) emails++;
    else console.error("[cron] promemoria servizi: email non inviata a", t.buyer_id, sent.error);
    const n = t.services.length;
    const { data: buyerTargets } = await supabase.rpc("network_user_push_targets", { p_secret: secret, p_user: t.buyer_id });
    if ((buyerTargets as PushTarget[] | null)?.length)
      await sendPushToTargets(buyerTargets as PushTarget[], {
        title: "Riconferma i servizi",
        body: `${t.seller_name}: ${n} ${n === 1 ? "servizio" : "servizi"} in programma, riconfermali con un tocco`,
        url: "/rete/riconferme",
      });
    const { data: sellerTargets } = await supabase.rpc("network_user_push_targets", { p_secret: secret, p_user: t.seller_id });
    if ((sellerTargets as PushTarget[] | null)?.length)
      await sendPushToTargets(sellerTargets as PushTarget[], {
        title: "Promemoria inviato",
        body: `${t.buyer_name} non aveva ancora riconfermato: promemoria con ${n} ${n === 1 ? "servizio" : "servizi"} partito`,
        url: "/rete/agenda",
      });
  }
  return { agencies: rows.length, services, emails };
}
