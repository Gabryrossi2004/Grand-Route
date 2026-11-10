import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadCommunityFeed } from "@/lib/community";
import { createPost } from "@/app/dashboard/community/actions";
import { deleteGroup, leaveGroup, removeMember } from "@/app/dashboard/community/groups/actions";
import PostComposer from "@/components/community/PostComposer";
import PostCard from "@/components/community/PostCard";
import InvitePanel from "@/components/community/InvitePanel";
import ConfirmDeleteButton from "@/components/community/ConfirmDeleteButton";
import type { CommunityGroup, CommunityGroupInvite } from "@/lib/types";

type MemberRow = {
  role: "owner" | "member";
  profile_id: string;
  community_profile_directory: { id: string; full_name: string | null; agency_name: string | null; logo_url: string | null } | null;
};

export default async function CommunityGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: group } = await supabase.from("community_groups").select("*").eq("id", id).single();

  if (!user || !group) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm text-slate-500">Non hai accesso a questo gruppo, oppure non esiste più.</p>
        <Link href="/dashboard/community/groups" className="mt-4 inline-block text-sm font-medium text-[#233c5e] hover:underline">
          ← Torna ai gruppi
        </Link>
      </div>
    );
  }

  const typedGroup = group as CommunityGroup;

  const [{ data: membership }, { data: memberRows }, feed] = await Promise.all([
    supabase.from("community_group_members").select("role").eq("group_id", id).eq("profile_id", user.id).single(),
    supabase
      .from("community_group_members")
      .select("role, profile_id, community_profile_directory(id, full_name, agency_name, logo_url)")
      .eq("group_id", id),
    loadCommunityFeed(supabase, id, user.id),
  ]);

  const isOwner = membership?.role === "owner";
  const members = (memberRows as unknown as MemberRow[]) || [];

  let invites: CommunityGroupInvite[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("community_group_invites")
      .select("*")
      .eq("group_id", id)
      .order("created_at", { ascending: false });
    invites = (data as CommunityGroupInvite[]) || [];
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/community/groups" className="text-sm font-medium text-[#233c5e] hover:underline">
          ← Torna ai gruppi
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="border-l-4 border-[#233c5e] pl-3 text-2xl font-semibold text-slate-900">{typedGroup.name}</h1>
            {typedGroup.description && <p className="mt-1 pl-3 text-sm text-slate-500">{typedGroup.description}</p>}
          </div>
          {isOwner ? (
            <ConfirmDeleteButton
              action={deleteGroup.bind(null, id)}
              confirmText="Eliminare definitivamente questo gruppo, tutti i suoi post e inviti?"
              label="Elimina gruppo"
            />
          ) : (
            <ConfirmDeleteButton
              action={leaveGroup.bind(null, id)}
              confirmText="Uscire da questo gruppo?"
              label="Esci dal gruppo"
            />
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Membri ({members.length})</h2>
        <div className="flex flex-col gap-1.5">
          {members.map((m) => (
            <div key={m.profile_id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">
                {m.community_profile_directory?.agency_name || m.community_profile_directory?.full_name || "Professionista"}
                {m.role === "owner" && <span className="ml-1.5 text-xs text-[#8c7a5e]">(Responsabile)</span>}
              </span>
              {isOwner && m.profile_id !== user.id && (
                <ConfirmDeleteButton
                  action={removeMember.bind(null, id, m.profile_id)}
                  confirmText="Rimuovere questo membro dal gruppo?"
                  label="Rimuovi"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {isOwner && (
        <div className="mb-6">
          <InvitePanel groupId={id} invites={invites} />
        </div>
      )}

      <div className="mb-6">
        <PostComposer action={createPost.bind(null, id)} placeholder="Scrivi qualcosa per il gruppo…" />
      </div>

      <div className="flex flex-col gap-4">
        {feed.posts.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e6d7bb] bg-white/60 p-6 text-center text-sm text-slate-500">
            Nessun post ancora in questo gruppo.
          </p>
        )}
        {feed.posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            photos={feed.photosByPost[post.id] || []}
            comments={feed.commentsByPost[post.id] || []}
            authors={feed.authors}
            currentUserId={user.id}
            groupId={id}
            canModerate={isOwner}
            likeCount={feed.likeCountByPost[post.id] || 0}
            likedByMe={Boolean(feed.likedByMe[post.id])}
          />
        ))}
      </div>
    </div>
  );
}
