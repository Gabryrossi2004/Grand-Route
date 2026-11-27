import TeamComingSoon from "@/components/TeamComingSoon";
import { getTeamContext } from "@/lib/team";

// Account di team, fase 1: questa sezione per ora è solo del fondatore dell'agenzia
export default async function FounderOnlyLayout({ children }: { children: React.ReactNode }) {
  const team = await getTeamContext();
  if (team?.isMember) return <TeamComingSoon />;
  return children;
}
