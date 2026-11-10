import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadCommunityFeed } from "@/lib/community";
import { createPost } from "@/app/dashboard/community/actions";
import PostComposer from "@/components/community/PostComposer";
import PostCard from "@/components/community/PostCard";

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { posts, photosByPost, commentsByPost, authors } = await loadCommunityFeed(supabase, null);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="border-l-4 border-[#2b333e] pl-3 text-2xl font-semibold text-slate-900">Community</h1>
          <p className="mt-1 text-sm text-slate-500">
            La bacheca pubblica tra agenzie: recensioni di hotel e fornitori, avvisi, consigli di viaggio.
          </p>
        </div>
        <Link
          href="/dashboard/community/groups"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e6d7bb] bg-white px-3 py-2 text-sm font-medium text-[#2b333e] shadow-sm hover:bg-[#f2e2c4]"
        >
          <Users size={16} />
          Gruppi
        </Link>
      </div>

      <div className="mb-6">
        <PostComposer action={createPost.bind(null, null)} placeholder="Condividi una novità con le altre agenzie…" />
      </div>

      <div className="flex flex-col gap-4">
        {posts.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#e6d7bb] bg-white/60 p-6 text-center text-sm text-slate-500">
            Nessun post ancora. Sii il primo a scrivere qualcosa!
          </p>
        )}
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            photos={photosByPost[post.id] || []}
            comments={commentsByPost[post.id] || []}
            authors={authors}
            currentUserId={user?.id ?? ""}
            groupId={null}
            canModerate={false}
          />
        ))}
      </div>
    </div>
  );
}
