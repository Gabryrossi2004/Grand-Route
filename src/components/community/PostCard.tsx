import { Compass } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { richTextClassName } from "@/lib/richText";
import { addComment, deleteComment, deletePost } from "@/app/dashboard/community/actions";
import ConfirmDeleteButton from "@/components/community/ConfirmDeleteButton";
import CommentForm from "@/components/community/CommentForm";
import DoubleTapLike from "@/components/community/DoubleTapLike";
import type { CommunityComment, CommunityPost, CommunityPostPhoto, CommunityProfileDirectoryEntry } from "@/lib/types";

function authorLabel(author: CommunityProfileDirectoryEntry | undefined) {
  if (!author) return "Un professionista";
  return author.agency_name || author.full_name || "Un professionista";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuthorAvatar({ author }: { author: CommunityProfileDirectoryEntry | undefined }) {
  if (author?.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={author.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#233c5e] text-white">
      <Compass size={16} />
    </span>
  );
}

export default function PostCard({
  post,
  photos,
  comments,
  authors,
  currentUserId,
  groupId,
  canModerate,
  likeCount,
  likedByMe,
}: {
  post: CommunityPost;
  photos: CommunityPostPhoto[];
  comments: CommunityComment[];
  authors: Record<string, CommunityProfileDirectoryEntry>;
  currentUserId: string;
  groupId: string | null;
  canModerate: boolean;
  likeCount: number;
  likedByMe: boolean;
}) {
  const author = authors[post.author_id];
  const canDeletePost = post.author_id === currentUserId || canModerate;

  return (
    <article className="rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <AuthorAvatar author={author} />
          <div>
            <p className="text-sm font-semibold text-slate-900">{authorLabel(author)}</p>
            <p className="text-xs text-slate-400">{formatDate(post.created_at)}</p>
          </div>
        </div>
        {canDeletePost && (
          <ConfirmDeleteButton
            action={deletePost.bind(null, groupId, post.id)}
            confirmText="Eliminare questo post e tutti i suoi commenti?"
          />
        )}
      </div>

      <DoubleTapLike postId={post.id} initialLiked={likedByMe} initialCount={likeCount}>
        {post.title && <h3 className="mt-3 font-semibold text-slate-900">{post.title}</h3>}
        <div
          className={`mt-2 ${richTextClassName}`}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
        />

        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.url}
                alt=""
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </DoubleTapLike>

      <div className="mt-4 border-t border-slate-100 pt-3">
        {comments.map((comment) => {
          const commentAuthor = authors[comment.author_id];
          const canDeleteComment = comment.author_id === currentUserId || canModerate;
          return (
            <div key={comment.id} className="mb-2 flex items-start justify-between gap-2 text-sm">
              <p>
                <span className="font-medium text-slate-800">{authorLabel(commentAuthor)}</span>{" "}
                <span className="text-slate-600">{comment.body}</span>
              </p>
              {canDeleteComment && (
                <ConfirmDeleteButton
                  action={deleteComment.bind(null, groupId, comment.id)}
                  confirmText="Eliminare questo commento?"
                  label="Elimina"
                />
              )}
            </div>
          );
        })}

        <CommentForm action={addComment.bind(null, groupId, post.id)} />
      </div>
    </article>
  );
}
