import { headers } from "next/headers";
import { areaHosts, areaHref } from "@/lib/areas";
import { ROLE_LABELS, type TeamRole } from "@/lib/teamRoles";

// Inviti nella squadra dell'agenzia: indirizzo della pagina d'invito e testo dell'email.

export const TEAM_INVITE_PATH = "/invito-squadra";

// Indirizzo completo della pagina d'invito (sul sito dei professionisti, se i due siti sono separati)
export async function buildTeamInviteLink(token: string): Promise<string> {
  const path = `${TEAM_INVITE_PATH}/${encodeURIComponent(token)}`;
  if (areaHosts()) return areaHref("pro", path);
  const host = (await headers()).get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}${path}`;
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildTeamInviteEmail(params: { agencyName: string; inviterName: string; role: TeamRole; link: string }) {
  const role = ROLE_LABELS[params.role];
  const subject = `${params.agencyName} ti invita nella sua squadra su Grand Route`;
  const intro = `${params.inviterName || params.agencyName} ti ha invitato a lavorare con ${params.agencyName} su Grand Route, con il ruolo «${role}».`;
  const how = "Apri il link, scegli una password e sei dentro: vedrai i viaggi, i clienti e i fornitori dell'agenzia. L'invito vale 14 giorni.";
  const text = ["Ciao,", "", intro, how, "", params.link, "", "A presto,", params.agencyName].join("\n");
  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#f6efe0;font-family:Arial,Helvetica,sans-serif;color:#1d2b40">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6efe0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#233c5e;padding:22px 26px;color:#faf3e6;font-size:15px">${esc(params.agencyName)}</td></tr>
<tr><td style="padding:28px 26px 8px"><p style="margin:0 0 14px;font-size:16px">Ciao,</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${esc(intro)}</p>
<p style="margin:0;font-size:16px;line-height:1.5">${esc(how)}</p></td></tr>
<tr><td style="padding:22px 26px 6px"><a href="${esc(params.link)}" style="display:inline-block;background:#233c5e;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 26px;border-radius:10px">Entra nella squadra</a></td></tr>
<tr><td style="padding:14px 26px 28px;font-size:14px;line-height:1.5;color:#5c594b">A presto,<br>${esc(params.agencyName)}</td></tr></table>
<p style="margin:14px 0 0;font-size:12px;color:#8a8672">Inviato con Grand Route per conto di ${esc(params.agencyName)}. Se non conosci chi ti ha invitato, ignora questa email.</p>
</td></tr></table></body></html>`;
  return { subject, html, text };
}

// Messaggi per gli esiti di accept_team_invite (migrazione 0075)
export const ACCEPT_MESSAGES: Record<string, string> = {
  ok: "Benvenuto nella squadra!",
  gia_membro: "Fai già parte di questa squadra.",
  non_trovato: "Questo invito non esiste. Controlla di aver copiato tutto il link.",
  revocato: "Questo invito è stato annullato. Chiedi al titolare di mandartene uno nuovo.",
  usato: "Questo invito è già stato usato.",
  scaduto: "Questo invito è scaduto. Chiedi al titolare di mandartene uno nuovo.",
  email: "L'invito è per un'altra email: accedi (o registrati) con l'email a cui è arrivato l'invito.",
  altra_squadra: "Il tuo account fa già parte della squadra di un'altra agenzia: per questa usa un'altra email.",
  ha_dati: "Questo account ha già viaggi, clienti o un'attività sua: per entrare nella squadra registrati con un'altra email.",
  non_professionista: "Questo è un account cliente o viaggiatore: per entrare nella squadra registrati con un'altra email.",
};
