import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function JoinGroupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: groupId, error } = await supabase.rpc("redeem_community_invite", { p_token: token });

  if (error || !groupId) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">Invito non valido</h1>
        <p className="text-sm text-slate-500">
          {error?.message || "Questo link di invito non è valido, è scaduto o è stato revocato."}
        </p>
        <Link href="/dashboard/community/groups" className="mt-6 inline-block text-sm font-medium text-[#2b333e] hover:underline">
          Torna ai gruppi
        </Link>
      </div>
    );
  }

  redirect(`/dashboard/community/groups/${groupId}`);
}
