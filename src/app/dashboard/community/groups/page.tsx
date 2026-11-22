import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import CreateGroupForm from "@/components/community/CreateGroupForm";
import JoinGroupForm from "@/components/community/JoinGroupForm";

type GroupMembership = {
  role: "owner" | "member";
  community_groups: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
  } | null;
};

export default async function CommunityGroupsPage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: memberships } = await supabase
    .from("community_group_members")
    .select("role, community_groups(id, name, description, created_at)")
    .eq("profile_id", user?.id ?? "")
    .order("joined_at", { ascending: false });

  const groups = ((memberships as unknown as GroupMembership[]) || []).filter((m) => m.community_groups);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/community" className="text-sm font-medium text-[#233c5e] hover:underline">
          ← Torna alla community
        </Link>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-[#233c5e]">I miei gruppi</h1>
        <p className="mt-1 text-sm text-slate-500">
          I gruppi di cui fai parte. Puoi crearne uno aperto (compare in vetrina) o privato (solo su invito: ideale per reti commerciali o colleghi).
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <CreateGroupForm />
        <JoinGroupForm />
      </div>

      <div className="flex flex-col gap-3">
        {groups.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e6d7bb] bg-white/60 p-6 text-center text-sm text-slate-500">
            Non fai ancora parte di nessun gruppo.
          </p>
        )}
        {groups.map((m) => (
          <Link
            key={m.community_groups!.id}
            href={`/dashboard/community/groups/${m.community_groups!.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30 transition hover:bg-[#faf3e6]"
          >
            <div>
              <p className="font-semibold text-slate-900">{m.community_groups!.name}</p>
              {m.community_groups!.description && (
                <p className="mt-0.5 text-sm text-slate-500">{m.community_groups!.description}</p>
              )}
            </div>
            {m.role === "owner" && (
              <span className="shrink-0 rounded-full bg-[#f2e2c4] px-2.5 py-1 text-xs font-medium text-[#6b5f4a]">
                Responsabile
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
