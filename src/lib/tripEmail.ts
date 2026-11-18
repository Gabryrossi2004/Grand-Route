// Testo della mail con cui l'agenzia invia il viaggio al cliente.

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmt = (value: string | null) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : null);

export function buildTripEmail(params: {
  clientName: string;
  agencyName: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  link: string;
  clientAreaLink: string;
}) {
  const first = params.clientName.trim().split(/\s+/)[0] || "";
  const dates = params.startDate && params.endDate ? `${fmt(params.startDate)} – ${fmt(params.endDate)}` : fmt(params.startDate);
  const subject = `Il tuo viaggio "${params.title}" è pronto`;

  const text = [
    first ? `Ciao ${first},` : "Ciao,",
    "",
    `${params.agencyName} ha preparato il tuo viaggio: ${params.title}${params.destination ? ` (${params.destination})` : ""}${dates ? `, ${dates}` : ""}.`,
    "",
    `Guarda l'itinerario qui: ${params.link}`,
    "",
    `Se hai un account nell'area clienti, lo trovi anche lì, con la chat per scrivere all'agenzia: ${params.clientAreaLink}`,
    "",
    `A presto,`,
    params.agencyName,
  ].join("\n");

  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#f6efe0;font-family:Arial,Helvetica,sans-serif;color:#1d2b40">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6efe0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#233c5e;padding:22px 26px;color:#faf3e6;font-size:15px;letter-spacing:.3px">${esc(params.agencyName)}</td></tr>
<tr><td style="padding:28px 26px 8px">
<p style="margin:0 0 14px;font-size:16px">${first ? `Ciao ${esc(first)},` : "Ciao,"}</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.5">abbiamo preparato il tuo viaggio. Eccolo:</p>
<p style="margin:0;font-size:22px;line-height:1.25;font-weight:bold;color:#233c5e">${esc(params.title)}</p>
${params.destination ? `<p style="margin:6px 0 0;font-size:15px;color:#5c594b">${esc(params.destination)}</p>` : ""}
${dates ? `<p style="margin:4px 0 0;font-size:15px;color:#5c594b">${esc(dates)}</p>` : ""}
</td></tr>
<tr><td style="padding:22px 26px 6px"><a href="${esc(params.link)}" style="display:inline-block;background:#233c5e;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 26px;border-radius:10px">Apri il tuo viaggio</a></td></tr>
<tr><td style="padding:14px 26px 28px;font-size:14px;line-height:1.5;color:#5c594b">
Se hai un account nell'<a href="${esc(params.clientAreaLink)}" style="color:#233c5e">area clienti</a>, trovi il viaggio anche lì, insieme alla chat per scrivere all'agenzia.<br><br>A presto,<br>${esc(params.agencyName)}
</td></tr></table>
<p style="margin:14px 0 0;font-size:12px;color:#8a8672">Inviato con Grand Route per conto di ${esc(params.agencyName)}.</p>
</td></tr></table></body></html>`;

  return { subject, html, text };
}
