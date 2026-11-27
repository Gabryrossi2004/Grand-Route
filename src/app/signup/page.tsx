import { cleanReferralCode } from "@/lib/referral";
import SignupForm from "@/components/network/SignupForm";

export const metadata = { title: "Registrazione" };

// Registrazione dei professionisti del turismo. «?tipo=guida» apre la pagina già sul tipo giusto.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ tipo?: string; invito?: string }> }) {
  const { tipo, invito } = await searchParams;
  return <SignupForm initialKind={tipo} referral={cleanReferralCode(invito)} />;
}
