import Link from "next/link";
import { Lock, MessageSquare, Plus, Star, Users } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { loadCommunityFeed } from "@/lib/community";
import { joinOpenGroup } from "@/app/dashboard/community/groups/actions";
import PostCard from "@/components/community/PostCard";
import { COMMUNITY_CATEGORIES, type CommunityGroup } from "@/lib/types";

export const metadata = { title: "Community" };

type Counts = { group_id: string; members: number; posts: number; last_post: string | null };

const categoryLabel = (v: string | null | undefined) => COMMUNITY_CATEGORIES.find((c) => c.value === v)?.label ?? "Altro";

function ago(iso: string | null) {
  if (!iso) return "nessun post ancora";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "attivo oggi";
  if (days === 1) return "ultimo post ieri";
  if (days < 30) return `ultimo post ${days} giorni fa`;
  return "poco attivo";
}

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const supabase = await createClient();
  const user = await getCachedUser();

  const [{ data: groupRows }, { data: memberRows }, { data: countRows }] = await Promise.all([
    supabase.from("community_groups").select("*").order("created_at", { ascending: false }),
    supabase.from("community_group_members").select("group_id, role").eq("profile_id", user?.id ?? ""),
    supabase.rpc("community_group_counts"),
  ]);

  const groups = (groupRows as CommunityGroup[] | null) ?? [];
  const mine = new Map(((memberRows as { group_id: string; role: string }[] | null) ?? []).map((m) => [m.group_id, m.role]));
  const counts = new Map(((countRows as Counts[] | null) ?? []).map((c) => [c.group_id, c]));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  const myGroups = groups.filter((g) => mine.has(g.id));
  const openGroups = groups
    .filter((g) => g.is_open)
    .filter((g) => !cat || g.category === cat)
    .sort((a, b) => Number(counts.get(b.id)?.posts ?? 0) - Number(counts.get(a.id)?.posts ?? 0));

  const feed = await loadCommunityFeed(supabase, myGroups.map((g) => g.id), user?.id, { limit: 8 });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Community</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            La vetrina dei professionisti del viaggio: entra nei gruppi, leggi le recensioni dei colleghi su hotel, tour e fornitori, fai domande.
          </p>
        </div>
        <Link
          href="/dashboard/community/groups"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#233c5e] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#17283f]"
        >
          <Plus size={16} /> Crea un gruppo o entra con invito
        </Link>
      </div>

      {myGroups.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-[#233c5e]">I tuoi gruppi</h2>
          <div className="flex flex-wrap gap-2">
            {myGroups.map((g) => (
              <Link
                key={g.id}
                href={`/dashboard/community/groups/${g.id}`}
                className="flex items-center gap-1.5 rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 text-sm font-medium text-[#233c5e] hover:bg-[#f2e2c4]"
              >
                {!g.is_open && <Lock size={12} className="text-slate-400" />}
                {g.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {feed.posts.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#233c5e]">Novità dai tuoi gruppi</h2>
          <div className="flex max-w-2xl flex-col gap-4">
            {feed.posts.map((post) => {
              const gid = post.group_id ?? "";
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  photos={feed.photosByPost[post.id] || []}
                  comments={feed.commentsByPost[post.id] || []}
                  authors={feed.authors}
                  currentUserId={user?.id ?? ""}
                  groupId={gid}
                  canModerate={mine.get(gid) === "owner"}
                  likeCount={feed.likeCountByPost[post.id] || 0}
                  likedByMe={Boolean(feed.likedByMe[post.id])}
                  groupName={groupName.get(gid)}
                />
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#233c5e]">Vetrina dei gruppi</h2>
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Link
            href="/dashboard/community"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${!cat ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#6b5f4a] hover:bg-[#f2e2c4]"}`}
          >
            Tutti
          </Link>
          {COMMUNITY_CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={`/dashboard/community?cat=${c.value}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${cat === c.value ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#6b5f4a] hover:bg-[#f2e2c4]"}`}
            >
              {c.label}
            </Link>
          ))}
        </div>

        {openGroups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#e6d7bb] bg-white/60 p-6 text-center text-sm text-slate-500">
            Nessun gruppo aperto{cat ? " in questa categoria" : " ancora"}. Crea il primo: scegli un tema (un hotel, una destinazione, un tour operator) e invita i colleghi.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {openGroups.map((g) => {
              const c = counts.get(g.id);
              const isMember = mine.has(g.id);
              return (
                <div key={g.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30">
                  <div>
                    <span className="rounded-full bg-[#f2e2c4] px-2.5 py-0.5 text-xs font-medium text-[#6b5f4a]">{categoryLabel(g.category)}</span>
                    <h3 className="mt-2 font-semibold text-slate-900">{g.name}</h3>
                    {g.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{g.description}</p>}
                  </div>
                  <div>
                    <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Users size={12} /> {Number(c?.members ?? 0)}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={12} /> {Number(c?.posts ?? 0)}</span>
                      <span className="flex items-center gap-1"><Star size={12} /> {ago(c?.last_post ?? null)}</span>
                    </p>
                    {isMember ? (
                      <Link href={`/dashboard/community/groups/${g.id}`} className="inline-block rounded-lg border border-[#233c5e] px-3 py-1.5 text-sm font-semibold text-[#233c5e] hover:bg-[#f2e2c4]">
                        Apri
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <form action={joinOpenGroup.bind(null, g.id)}>
                          <button type="submit" className="rounded-lg bg-[#233c5e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#17283f]">
                            Entra nel gruppo
                          </button>
                        </form>
                        <Link href={`/dashboard/community/groups/${g.id}`} className="text-sm font-medium text-[#233c5e] hover:underline">
                          Dai un&apos;occhiata
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
