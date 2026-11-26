// «Sconto Rotta»: più viaggi verificati hai (cliente con account che conferma, oppure fornitore verificato che conferma
// un servizio), più lo sconto sul piano. I conti veri li fa il database (migrazione 0073); qui solo tipi e testi.

export const TIERS = [
  { at: 5, pct: 10 },
  { at: 15, pct: 20 },
  { at: 40, pct: 30 },
] as const;

export type RottaSummary = {
  verified: number;
  pending: number;
  excluded: number;
  discount: number;
  next_at: number | null;
  next_discount: number | null;
};

export type RottaState = "verificato" | "in_attesa" | "senza_account" | "non_partito" | "oltre_limite";

export type RottaRow = {
  trip_id: string;
  title: string;
  destination: string | null;
  end_day: string;
  client_name: string | null;
  state: RottaState;
  confirmed_by: "cliente" | "fornitore" | null;
  counted: boolean;
  reminder_sent_at: string | null;
};

export const STATE_TEXT: Record<RottaState, { label: string; why: string }> = {
  verificato: { label: "Verificato", why: "Conta per lo sconto." },
  in_attesa: { label: "In attesa di conferma", why: "Aspetta che il cliente confermi, oppure che un fornitore verificato confermi un servizio." },
  senza_account: { label: "Cliente senza account", why: "Il cliente deve avere un account nell'area clienti (con un'email diversa dalla tua). Invitalo dalla scheda del viaggio." },
  non_partito: { label: "Il cliente non è partito", why: "Il cliente ha indicato di non aver fatto il viaggio: non conta." },
  oltre_limite: { label: "Oltre il limite", why: "Contano al massimo 2 viaggi per lo stesso cliente ogni 12 mesi." },
};

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Mail con cui l'agenzia chiede al cliente di confermare il viaggio (una sola volta per viaggio)
export function buildConfirmEmail(params: { clientName: string; agencyName: string; title: string; link: string }) {
  const first = params.clientName.trim().split(/\s+/)[0] || "";
  const hello = first ? `Ciao ${first},` : "Ciao,";
  const subject = `Com'è andato il viaggio "${params.title}"?`;
  const text = [
    hello,
    "",
    `speriamo che il viaggio «${params.title}» sia stato bellissimo!`,
    "Ci aiuti con un tocco? Nella tua area riservata trovi un pulsante per confermare di aver fatto il viaggio: ci vuole un secondo.",
    "",
    params.link,
    "",
    "Grazie e a presto,",
    params.agencyName,
  ].join("\n");
  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#f6efe0;font-family:Arial,Helvetica,sans-serif;color:#1d2b40">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6efe0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#233c5e;padding:22px 26px;color:#faf3e6;font-size:15px">${esc(params.agencyName)}</td></tr>
<tr><td style="padding:28px 26px 8px"><p style="margin:0 0 14px;font-size:16px">${esc(hello)}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">speriamo che il viaggio <strong>${esc(params.title)}</strong> sia stato bellissimo!</p>
<p style="margin:0;font-size:16px;line-height:1.5">Ci aiuti con un tocco? Nella tua area riservata trovi un pulsante per confermare di aver fatto il viaggio: ci vuole un secondo.</p></td></tr>
<tr><td style="padding:22px 26px 6px"><a href="${esc(params.link)}" style="display:inline-block;background:#233c5e;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 26px;border-radius:10px">Apri la mia area</a></td></tr>
<tr><td style="padding:14px 26px 28px;font-size:14px;line-height:1.5;color:#5c594b">Grazie e a presto,<br>${esc(params.agencyName)}</td></tr></table>
<p style="margin:14px 0 0;font-size:12px;color:#8a8672">Inviato con Grand Route per conto di ${esc(params.agencyName)}.</p>
</td></tr></table></body></html>`;
  return { subject, html, text };
}
