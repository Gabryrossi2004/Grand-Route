// Invio mail transazionali con Resend (https://resend.com), senza librerie:
// una sola chiamata HTTP dal server. La chiave RESEND_API_KEY non esce mai dal server.

export type MailResult = { ok: true } | { ok: false; error: string };

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  fromName?: string | null;
}): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "not_configured" };

  const base = process.env.MAIL_FROM || "Grand Route <noreply@mail.grandroute.it>";
  const address = /<([^>]+)>/.exec(base)?.[1] ?? base;
  const name = (params.fromName || /^([^<]+)</.exec(base)?.[1] || "Grand Route").replace(/["<>\r\n]/g, "").trim();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${name} <${address}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      console.error("[sendMail] Resend", response.status, body?.message);
      return { ok: false, error: response.status === 401 || response.status === 403 ? "rejected" : response.status === 422 ? "invalid" : "failed" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[sendMail]", (error as Error).message);
    return { ok: false, error: "failed" };
  }
}
