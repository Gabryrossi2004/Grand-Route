import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { loadCommunityFeed } from "@/lib/community";
import { createPost } from "@/app/dashboard/community/actions";
import { deleteGroup, joinOpenGroup, leaveGroup, removeMember } from "@/app/dashboard/community/groups/actions";
import { dismissReport } from "@/app/dashboard/community/actions";
import { Lock } from "lucide-react";
import PostComposer from "@/components/community/PostComposer";
import PostCard from "@/components/community/PostCard";
import InvitePanel from "@/components/community/InvitePanel";
import ConfirmDeleteButton from "@/components/community/ConfirmDeleteButton";
import { COMMUNITY_CATEGORIES, type CommunityGroup, type CommunityGroupInvite } from "@/lib/types";

type MemberRow = {
  role: "owner" | "member";
  profile_id: string;
  community_profile_directory: { id: string; full_name: string | null; agency_name: string | null; logo_url: string | null } | null;
};

type ReportRow = { id: string; reporter_id: string; post_id: string | null; comment_id: string | null; reason: string; note: string | null; created_at: string };
const REASON_LABEL: Record<string, string> = {
  offensivo: "Toni offensivi o scorretti",
  spam: "Pubblicità o spam",
  dati_personali: "Dati personali di clienti",
  falso: "Informazioni false o ingannevoli",
  altro: "Altro",
};
const KIND_FILTERS = [
  { value: "", label: "Tutto" },
  { value: "recensione", label: "Recensioni" },
  { value: "domanda", label: "Domande" },
  { value: "chat", label: "Chat" },
];

export default async function CommunityGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { id } = await params;
  const { tipo } = await searchParams;
  const kindFilter = KIND_FILTERS.some((k) => k.value && k.value === tipo) ? tipo : undefined;
  const supabase = await createClient();
  const user = await getCachedUser();

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
    supabase.from("community_group_members").select("role").eq("group_id", id).eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("community_group_members")
      .select("role, profile_id, community_profile_directory(id, full_name, agency_name, logo_url)")
      .eq("group_id", id),
    loadCommunityFeed(supabase, id, user.id, { kind: kindFilter }),
  ]);

  const isOwner = membership?.role === "owner";
  const isMember = Boolean(membership);
  const isOpen = Boolean(typedGroup.is_open);
  const categoryName = COMMUNITY_CATEGORIES.find((c) => c.value === typedGroup.category)?.label;
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

  let reports: ReportRow[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("community_reports")
      .select("id, reporter_id, post_id, comment_id, reason, note, created_at")
      .eq("group_id", id)
      .eq("handled", false)
      .order("created_at", { ascending: false });
    reports = (data as ReportRow[] | null) ?? [];
  }
  const commentById = new Map(Object.values(feed.commentsByPost).flat().map((c) => [c.id, c]));
  const postById = new Map(feed.posts.map((p) => [p.id, p]));
  const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/dashboard/community" className="text-sm font-medium text-[#233c5e] hover:underline">
          ← Torna alla community
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-medium text-[#756548]">
              {!isOpen && <span className="flex items-center gap-1"><Lock size={12} /> Gruppo privato</span>}
              {isOpen && <span>Gruppo aperto</span>}
              {categoryName && <span>· {categoryName}</span>}
            </p>
            <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">{typedGroup.name}</h1>
            {typedGroup.description && <p className="mt-1 pl-3 text-sm text-slate-500">{typedGroup.description}</p>}
          </div>
          {!isMember ? (
            isOpen && (
              <form action={joinOpenGroup.bind(null, id)}>
                <button type="submit" className="rounded-lg bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f]">
                  Entra nel gruppo
                </button>
              </form>
            )
          ) : isOwner ? (
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
                {m.role === "owner" && <span className="ml-1.5 text-xs text-[#756548]">(Responsabile)</span>}
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

      {isOwner && reports.length > 0 && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <h2 className="mb-2 text-sm font-semibold text-red-700">Segnalazioni da controllare ({reports.length})</h2>
          <div className="flex flex-col gap-3">
            {reports.map((r) => {
              const post = r.post_id ? postById.get(r.post_id) : undefined;
              const comment = r.comment_id ? commentById.get(r.comment_id) : undefined;
              const text = comment ? comment.body : post ? post.title || strip(post.body) : "";
              return (
                <div key={r.id} className="rounded-lg bg-white p-3 text-sm">
                  <p className="font-medium text-slate-800">
                    {REASON_LABEL[r.reason] ?? r.reason}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {r.comment_id ? "su un commento" : "su un post"} · da {feed.authors[r.reporter_id]?.agency_name || "un membro"}
                    </span>
                  </p>
                  {r.note && <p className="mt-0.5 text-slate-600">«{r.note}»</p>}
                  {text && <p className="mt-1 border-l-2 border-slate-200 pl-2 text-xs text-slate-500">{text}</p>}
                  <div className="mt-2 flex items-center gap-4">
                    <ConfirmDeleteButton action={dismissReport.bind(null, id, r.id)} confirmText="Segnare come controllata? Il contenuto resta visibile." label="Va bene così" />
                    <span className="text-xs text-slate-500">Per rimuoverlo, usa «Elimina» sul contenuto qui sotto.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isOwner && (
        <div className="mb-6">
          <InvitePanel groupId={id} invites={invites} />
        </div>
      )}

      {isMember ? (
        <div className="mb-6">
          <PostComposer action={createPost.bind(null, id)} />
        </div>
      ) : (
        <p className="mb-6 rounded-xl border border-dashed border-[#e6d7bb] bg-white/60 p-4 text-center text-sm text-slate-600">
          Stai guardando l&apos;anteprima del gruppo. Entra per scrivere, rispondere e lasciare recensioni.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((k) => {
          const active = (kindFilter ?? "") === k.value;
          return (
            <Link
              key={k.value}
              href={k.value ? `/dashboard/community/groups/${id}?tipo=${k.value}` : `/dashboard/community/groups/${id}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#6b5f4a] hover:bg-[#f2e2c4]"}`}
            >
              {k.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        {feed.posts.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e6d7bb] bg-white/60 p-6 text-center text-sm text-slate-500">
            Ancora niente qui: scrivi la prima recensione o la prima domanda!
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
            canInteract={isMember}
            likeCount={feed.likeCountByPost[post.id] || 0}
            likedByMe={Boolean(feed.likedByMe[post.id])}
          />
        ))}
      </div>
    </div>
  );
}
