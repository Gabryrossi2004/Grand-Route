// Account di squadra: ruoli e permessi. Senza dipendenze dal server (lo usano anche i componenti).
// MATRICE DEI PERMESSI: l'unico posto da cambiare lato app; nel database la stessa regola è in
// public.team_role_can() (migrazione 0075). Oggi tutti leggono e modificano tutti i dati dell'agenzia
// (in emergenza l'operativo corregge ciò che ha fatto il booking e viceversa): i ruoli sono etichette.
// Solo i titolari gestiscono la squadra e le impostazioni dell'agenzia (profilo, logo, piano di Zefiro).

export const TEAM_ROLES = ["titolare", "operativo", "contabilita", "booking"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export type AccountMode = "individuale" | "azienda";

// Sezioni con permessi diversi: «dati» = viaggi, clienti, fornitori, pagamenti, libreria...
export type TeamSection = "dati" | "squadra" | "impostazioni";

export const ROLE_LABELS: Record<TeamRole, string> = {
  titolare: "Titolare",
  operativo: "Operativo",
  contabilita: "Contabilità",
  booking: "Booking",
};

export const ROLE_HINTS: Record<TeamRole, string> = {
  titolare: "Tutto, compresi squadra, impostazioni dell'agenzia e piano",
  operativo: "Viaggi, clienti, libreria: lavora su tutti i dati",
  contabilita: "Pagamenti e incassi: lavora su tutti i dati",
  booking: "Fornitori, servizi e riconferme: lavora su tutti i dati",
};

export function isTeamRole(value: unknown): value is TeamRole {
  return typeof value === "string" && (TEAM_ROLES as readonly string[]).includes(value);
}

export function roleCan(role: TeamRole, section: TeamSection): boolean {
  if (role === "titolare") return true;
  return section === "dati";
}
