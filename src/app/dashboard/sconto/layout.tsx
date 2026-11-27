import TeamComingSoon, { ONLY_TITOLARE_TEXT } from "@/components/TeamComingSoon";
import { getTeamContext } from "@/lib/team";

// Lo Sconto Rotta riguarda il piano dell'agenzia: lo vedono i titolari
export default async function TitolareOnlyLayout({ children }: { children: React.ReactNode }) {
  const team = await getTeamContext();
  if (team && !team.isTitolare) return <TeamComingSoon title="Riservato al titolare" text={ONLY_TITOLARE_TEXT} />;
  return children;
}
