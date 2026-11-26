// Le due aree di Grand Route: PROFESSIONISTI (agenzie, tour operator, agenzie locali, guide, autisti, strutture…)
// e CLIENTI (clienti di un'agenzia e viaggiatori che si organizzano da soli). Ognuna ha il suo accesso.
// Oggi stanno sullo stesso sito; più avanti diventeranno due app/siti separati: per questo ogni regola di
// «a quale area appartiene questa pagina» e «dove sta l'altra area» è in questo file solo.
// Senza dipendenze dal server: lo usano anche proxy.ts e i componenti.

export type Area = "pro" | "client";

export const PRO_LOGIN = "/professionisti";
export const CLIENT_LOGIN = "/clienti";

const PRO_PREFIXES = ["/dashboard", "/rete", "/professionisti", "/signup", "/stampa"];
const CLIENT_PREFIXES = ["/client", "/viaggiatore", "/clienti"];

const hasPrefix = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

// A quale area appartiene una pagina (null = condivisa: pagine pubbliche dei viaggi, privacy, termini, recupero password…)
export function areaOfPath(pathname: string): Area | null {
  if (PRO_PREFIXES.some((p) => hasPrefix(pathname, p))) return "pro";
  if (CLIENT_PREFIXES.some((p) => hasPrefix(pathname, p))) return "client";
  return null;
}

// ---------- Due siti separati (facoltativo) ----------
// Con NEXT_PUBLIC_PRO_HOST e NEXT_PUBLIC_CLIENT_HOST (solo il nome del sito, es. pro.grandroute.it e grandroute.it)
// ogni area risponde solo sul proprio sito e manda l'altra a quello giusto. Senza le due variabili tutto resta su un sito solo.
const cleanHost = (h: string | undefined) => (h ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

export function areaHosts(env: { pro?: string; client?: string } = { pro: process.env.NEXT_PUBLIC_PRO_HOST, client: process.env.NEXT_PUBLIC_CLIENT_HOST }): { pro: string; client: string } | null {
  const pro = cleanHost(env.pro);
  const client = cleanHost(env.client);
  return pro && client && pro !== client ? { pro, client } : null;
}

const protocolFor = (host: string) => (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");

// Indirizzo (assoluto se i due siti sono separati) di una pagina dell'altra area
export function areaHref(area: Area, path: string, hosts = areaHosts()): string {
  if (!hosts) return path;
  const host = area === "pro" ? hosts.pro : hosts.client;
  return `${protocolFor(host)}://${host}${path}`;
}

export type HostRoute = { kind: "none" } | { kind: "rewrite"; pathname: string } | { kind: "redirect"; url: string };

// Cosa fare con una richiesta quando i due siti sono separati
export function routeForHost(host: string | null, pathname: string, search: string, hosts = areaHosts()): HostRoute {
  if (!hosts || !host) return { kind: "none" };
  const h = host.toLowerCase();
  const here: Area | null = h === hosts.pro ? "pro" : h === hosts.client ? "client" : null;
  if (!here) return { kind: "none" }; // altri indirizzi (anteprime, localhost…): tutto resta com'è
  if (pathname === "/") return { kind: "rewrite", pathname: here === "pro" ? PRO_LOGIN : CLIENT_LOGIN };
  // gli indirizzi di accesso di una volta portano all'ingresso dell'area giusta
  if (pathname === "/login") return here === "pro" ? { kind: "rewrite", pathname: PRO_LOGIN } : { kind: "redirect", url: areaHref("pro", `${PRO_LOGIN}${search}`, hosts) };
  const of = areaOfPath(pathname);
  if (of && of !== here) return { kind: "redirect", url: areaHref(of, `${pathname}${search}`, hosts) };
  return { kind: "none" };
}

// ---------- Chi può entrare da quale porta ----------
export type AccountFlags = { is_professional: boolean | null; is_traveler: boolean | null; has_client_link: boolean };
export type AccessDecision = { ok: true; to: string } | { ok: false; reason: "not-professional" | "professional-only" };

// Porta dei professionisti: solo account professionali (i viaggiatori e i clienti non entrano)
// Porta dei clienti: viaggiatori, clienti di un'agenzia e chi ha già una scheda cliente collegata; un professionista «puro» no
export function decideAccess(area: Area, f: AccountFlags): AccessDecision {
  if (area === "pro") return f.is_professional === false ? { ok: false, reason: "not-professional" } : { ok: true, to: "/dashboard" };
  const isClient = !!f.is_traveler || f.is_professional === false || f.has_client_link;
  if (!isClient) return { ok: false, reason: "professional-only" };
  return { ok: true, to: f.is_traveler ? "/viaggiatore" : "/client" };
}

// «next» dopo l'accesso: solo pagine dell'area giusta (mai indirizzi esterni)
export function safeNext(area: Area, next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  const a = areaOfPath(next.split("?")[0]);
  return a === area && !next.startsWith(PRO_LOGIN) && !next.startsWith(CLIENT_LOGIN) ? next : null;
}
