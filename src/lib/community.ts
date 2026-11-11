import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommunityComment,
  CommunityPost,
  CommunityPostLike,
  CommunityPostPhoto,
  CommunityProfileDirectoryEntry,
} from "@/lib/types";

export type CommunityFeed = {
  posts: CommunityPost[];
  photosByPost: Record<string, CommunityPostPhoto[]>;
  commentsByPost: Record<string, CommunityComment[]>;
  authors: Record<string, CommunityProfileDirectoryEntry>;
  likeCountByPost: Record<string, number>;
  likedByMe: Record<string, boolean>;
};

export async function loadCommunityFeed(
  supabase: SupabaseClient,
  groupId: string | null,
  currentUserId?: string,
): Promise<CommunityFeed> {
  const postsQuery = supabase
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: posts } = groupId
    ? await postsQuery.eq("group_id", groupId)
    : await postsQuery.is("group_id", null);

  const typedPosts = (posts as CommunityPost[]) || [];
  const postIds = typedPosts.map((p) => p.id);

  if (postIds.length === 0) {
    return { posts: [], photosByPost: {}, commentsByPost: {}, authors: {}, likeCountByPost: {}, likedByMe: {} };
  }

  // L'autore di ogni post lo sappiamo già a questo punto: lo richiediamo in
  // parallelo col resto invece di aspettare anche i commenti, per risparmiare
  // un giro di andata e ritorno al database.
  const postAuthorIds = Array.from(new Set(typedPosts.map((p) => p.author_id)));

  const [{ data: photos }, { data: comments }, { data: likes }, { data: postAuthorRows }] = await Promise.all([
    supabase.from("community_post_photos").select("*").in("post_id", postIds),
    supabase.from("community_comments").select("*").in("post_id", postIds).order("created_at", { ascending: true }),
    supabase.from("community_post_likes").select("*").in("post_id", postIds),
    supabase.from("community_profile_directory").select("*").in("id", postAuthorIds),
  ]);

  const likeCountByPost: Record<string, number> = {};
  const likedByMe: Record<string, boolean> = {};
  for (const like of (likes as CommunityPostLike[]) || []) {
    likeCountByPost[like.post_id] = (likeCountByPost[like.post_id] || 0) + 1;
    if (currentUserId && like.profile_id === currentUserId) {
      likedByMe[like.post_id] = true;
    }
  }

  const photosByPost: Record<string, CommunityPostPhoto[]> = {};
  for (const photo of (photos as CommunityPostPhoto[]) || []) {
    (photosByPost[photo.post_id] ??= []).push(photo);
  }

  const commentsByPost: Record<string, CommunityComment[]> = {};
  for (const comment of (comments as CommunityComment[]) || []) {
    (commentsByPost[comment.post_id] ??= []).push(comment);
  }

  const authors: Record<string, CommunityProfileDirectoryEntry> = {};
  for (const row of (postAuthorRows as CommunityProfileDirectoryEntry[]) || []) {
    authors[row.id] = row;
  }

  // Chi ha commentato ma non ha mai scritto un post lo recuperiamo solo ora,
  // di solito sono pochi o nessuno (gli autori dei post di solito coprono già
  // la maggior parte dei commenti).
  const commentAuthorIds = Array.from(
    new Set(((comments as CommunityComment[]) || []).map((c) => c.author_id).filter((id) => !authors[id])),
  );

  if (commentAuthorIds.length > 0) {
    const { data: commentAuthorRows } = await supabase
      .from("community_profile_directory")
      .select("*")
      .in("id", commentAuthorIds);
    for (const row of (commentAuthorRows as CommunityProfileDirectoryEntry[]) || []) {
      authors[row.id] = row;
    }
  }

  return { posts: typedPosts, photosByPost, commentsByPost, authors, likeCountByPost, likedByMe };
}
