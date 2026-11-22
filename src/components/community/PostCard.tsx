import { Compass, HelpCircle, MessageCircle, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { flagOf, nameItOfCode } from "@/lib/geo/countryCodes";
import ReportButton from "@/components/community/ReportButton";
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
  canInteract = true,
  groupName,
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
  /** false = sola lettura (gruppo aperto non ancora seguito) */
  canInteract?: boolean;
  groupName?: string;
}) {
  const author = authors[post.author_id];
  const canDeletePost = post.author_id === currentUserId || canModerate;
  const kind = post.kind ?? "chat";
  const reportGroupId = canInteract ? groupId : null;

  return (
    <article className="rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <AuthorAvatar author={author} />
          <div>
            <p className="text-sm font-semibold text-slate-900">{authorLabel(author)}</p>
            <p className="text-xs text-slate-500">
              {formatDate(post.created_at)}
              {groupName && <span> · {groupName}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
        {reportGroupId && post.author_id !== currentUserId && <ReportButton groupId={reportGroupId} postId={post.id} />}
        {canDeletePost && (
          <ConfirmDeleteButton
            action={deletePost.bind(null, groupId, post.id)}
            confirmText="Eliminare questo post e tutti i suoi commenti?"
          />
        )}
        </div>
      </div>

      <DoubleTapLike postId={post.id} initialLiked={likedByMe} initialCount={likeCount}>
        {kind === "recensione" ? (
          <div className="mt-3 rounded-xl bg-[#faf3e6] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#756548]">Recensione</p>
            <h3 className="mt-0.5 font-semibold text-slate-900">{post.subject || post.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex" aria-label={`${post.rating ?? 0} stelle su 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={16} className={n <= (post.rating ?? 0) ? "fill-[#cda876] text-[#cda876]" : "text-slate-300"} />
                ))}
              </span>
              {post.country_code && (
                <span className="text-xs text-slate-600">
                  {flagOf(post.country_code)} {nameItOfCode(post.country_code)}
                </span>
              )}
              {post.would_resell === true && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <ThumbsUp size={12} /> Lo rivenderei
                </span>
              )}
              {post.would_resell === false && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                  <ThumbsDown size={12} /> Non lo rivenderei
                </span>
              )}
            </div>
            {(post.pros || post.cons) && (
              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {post.pros && (
                  <p className="text-slate-700">
                    <span className="font-medium text-emerald-700">＋ </span>
                    {post.pros}
                  </p>
                )}
                {post.cons && (
                  <p className="text-slate-700">
                    <span className="font-medium text-red-600">－ </span>
                    {post.cons}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : kind === "domanda" ? (
          <h3 className="mt-3 flex items-start gap-1.5 font-semibold text-slate-900">
            <HelpCircle size={18} className="mt-0.5 shrink-0 text-[#cda876]" />
            {post.title}
          </h3>
        ) : (
          <p className="mt-3 flex items-center gap-1 text-xs text-slate-400">
            <MessageCircle size={12} /> Chat
          </p>
        )}
        {post.body && (
          <div className={`mt-2 ${richTextClassName}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }} />
        )}

        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        )}
      </DoubleTapLike>

      <div className="mt-4 border-t border-slate-100 pt-3">
        {kind === "domanda" && comments.length > 0 && (
          <p className="mb-2 text-xs font-semibold text-slate-500">
            {comments.length} {comments.length === 1 ? "risposta" : "risposte"}
          </p>
        )}
        {comments.map((comment) => {
          const commentAuthor = authors[comment.author_id];
          const canDeleteComment = comment.author_id === currentUserId || canModerate;
          return (
            <div key={comment.id} className="mb-2 flex items-start justify-between gap-2 text-sm">
              <p>
                <span className="font-medium text-slate-800">{authorLabel(commentAuthor)}</span>{" "}
                <span className="text-slate-600">{comment.body}</span>
              </p>
              <span className="flex shrink-0 items-center gap-2">
                {reportGroupId && comment.author_id !== currentUserId && (
                  <ReportButton groupId={reportGroupId} commentId={comment.id} />
                )}
                {canDeleteComment && (
                  <ConfirmDeleteButton
                    action={deleteComment.bind(null, groupId, comment.id)}
                    confirmText="Eliminare questo commento?"
                    label="Elimina"
                  />
                )}
              </span>
            </div>
          );
        })}

        {canInteract ? (
          <CommentForm
            action={addComment.bind(null, groupId, post.id)}
            placeholder={kind === "domanda" ? "Scrivi una risposta…" : "Scrivi un commento…"}
          />
        ) : (
          <p className="text-xs text-slate-400">Unisciti al gruppo per rispondere.</p>
        )}
      </div>
    </article>
  );
}
