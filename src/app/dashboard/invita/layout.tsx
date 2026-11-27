import TeamComingSoon from "@/components/TeamComingSoon";
import { getTeamContext } from "@/lib/team";

// «Invita un collega» (sconto sul piano) lo gestisce chi ha aperto l'account dell'agenzia
export default async function FounderOnlyLayout({ children }: { children: React.ReactNode }) {
  const team = await getTeamContext();
  if (team?.isMember) return <TeamComingSoon title="Riservato a chi ha aperto l'account" text="Gli inviti con sconto sul piano li gestisce chi ha aperto l'account dell'agenzia." />;
  return children;
}
