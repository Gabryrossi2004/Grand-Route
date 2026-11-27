import { redirect } from "next/navigation";

// Vecchio indirizzo degli inviti: porta a quello nuovo
export default async function OldInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/invito-team/${encodeURIComponent(token)}`);
}
