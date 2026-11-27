import { cache } from "react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { isTeamRole, roleCan, type AccountMode, type TeamRole, type TeamSection } from "@/lib/teamRoles";

// Per quale agenzia lavora chi è collegato, e con che ruolo.
// L'«azienda» è il profilo di chi l'ha aperta (il fondatore): owner_id nei dati = companyId.
// Chi non è stato invitato da nessuno è il titolare della propria azienda (companyId = il suo id).
// Se la migrazione 0075 non è ancora stata eseguita: azienda = sé stessi, titolare, account individuale
// (così il codice nuovo non rompe nulla).
export type TeamContext = {
  userId: string;
  companyId: string;
  role: TeamRole;
  isFounder: boolean; // ha aperto l'azienda
  isMember: boolean; // è stato invitato in un'azienda non sua
  isTitolare: boolean;
  accountMode: AccountMode; // dell'azienda
  can: (section: TeamSection) => boolean;
};

export const getTeamContext = cache(async (): Promise<TeamContext | null> => {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();
  let companyId = user.id;
  let role: TeamRole = "titolare";
  const { data, error } = await supabase.from("team_members").select("company_id, role").eq("user_id", user.id).maybeSingle();
  const row = data as { company_id?: string; role?: string } | null;
  if (!error && row?.company_id && isTeamRole(row.role)) {
    companyId = row.company_id;
    role = row.role;
  }
  let accountMode: AccountMode = "individuale";
  if (!error) {
    const { data: company } = await supabase.from("profiles").select("account_mode").eq("id", companyId).maybeSingle();
    if ((company as { account_mode?: string } | null)?.account_mode === "azienda") accountMode = "azienda";
  }
  const isMember = companyId !== user.id;
  return {
    userId: user.id,
    companyId,
    role,
    isFounder: !isMember,
    isMember,
    isTitolare: role === "titolare",
    accountMode,
    can: (section) => roleCan(role, section),
  };
});

// Id dell'azienda per filtrare i dati (owner_id). null se non c'è nessuno collegato.
export async function getCompanyId(): Promise<string | null> {
  return (await getTeamContext())?.companyId ?? null;
}

export const NOT_TITOLARE = "Solo il titolare dell'agenzia può modificare questa impostazione.";

// Azienda dell'utente indicato (di solito quello collegato): per le azioni del server che hanno già l'utente
export async function companyIdOf(userId: string): Promise<string> {
  const team = await getTeamContext();
  return team && team.userId === userId ? team.companyId : userId;
}

export type TeamPerson = { id: string; name: string; role: TeamRole; isFounder: boolean };

// Le persone del team (fondatore + colleghi), per «assegnato a» e il filtro «I miei viaggi».
// Vuoto per gli account individuali senza colleghi (e se la migrazione 0075 non c'è ancora).
export const getTeamPeople = cache(async (): Promise<TeamPerson[]> => {
  const team = await getTeamContext();
  if (!team) return [];
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("team_members").select("user_id, role").eq("company_id", team.companyId);
  if (error) return [];
  const members = ((rows as { user_id: string; role: string }[] | null) ?? []).filter((r) => isTeamRole(r.role));
  if (members.length === 0 && team.accountMode !== "azienda") return [];
  const ids = [team.companyId, ...members.map((m) => m.user_id)];
  const { data: people } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  const byId = new Map(((people as { id: string; full_name: string | null; email: string | null }[] | null) ?? []).map((p) => [p.id, p]));
  const nameOf = (id: string) => byId.get(id)?.full_name || byId.get(id)?.email?.split("@")[0] || "Collega";
  return [
    { id: team.companyId, name: nameOf(team.companyId), role: "titolare" as TeamRole, isFounder: true },
    ...members.map((m) => ({ id: m.user_id, name: nameOf(m.user_id), role: m.role as TeamRole, isFounder: false })),
  ];
});

// Nella rete Partner e nella Posta si agisce a nome dell'agenzia: restituisce l'utente collegato con l'id
// dell'AZIENDA al posto del suo (personId resta la persona). Per chi lavora da solo è identico a prima.
export async function getNetworkUser(): Promise<{ id: string; email?: string; personId: string } | null> {
  const user = await getCachedUser();
  if (!user) return null;
  const team = await getTeamContext();
  return { ...user, id: team?.companyId ?? user.id, personId: user.id };
}
