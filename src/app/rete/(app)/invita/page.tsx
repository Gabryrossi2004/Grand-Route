import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import InviteView from "@/components/InviteView";
import { buildInviteLink } from "@/lib/inviteLink";
import type { ReferralOverview } from "@/lib/referral";

export const metadata = { title: "Invita un collega" };

export default async function InvitePage() {
  const user = await getCachedUser();
  if (!user) redirect("/professionisti?next=/rete/invita");
  const supabase = await createClient();
  const { data } = await supabase.rpc("referral_overview");
  const overview = (data as ReferralOverview | null) ?? null;
  return <InviteView data={overview} link={await buildInviteLink(overview?.code)} backHref="/rete/home" />;
}
