import SignupForm from "@/components/network/SignupForm";

export const metadata = { title: "Registrazione" };

// Registrazione dei professionisti del turismo. «?tipo=guida» apre la pagina già sul tipo giusto.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  return <SignupForm initialKind={tipo} />;
}
