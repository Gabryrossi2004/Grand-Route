"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { detectFileMime, safeStorageName, validateImageFile, verifyFileSignature } from "@/lib/fileValidation";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";

const MAX_PHOTOS_PER_POST = 6;

function communityPath(groupId: string | null) {
  return groupId ? `/dashboard/community/groups/${groupId}` : "/dashboard/community";
}

export async function createPost(
  groupId: string | null,
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Devi essere loggato." };

  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  if (!body || body === "<p></p>") {
    return { error: "Scrivi qualcosa prima di pubblicare." };
  }

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_PHOTOS_PER_POST) {
    return { error: `Puoi allegare al massimo ${MAX_PHOTOS_PER_POST} foto per post.` };
  }
  for (const photo of photos) {
    const validationError = validateImageFile(photo) ?? (await verifyFileSignature(photo));
    if (validationError) return { error: validationError };
  }

  const { data: post, error } = await supabase
    .from("community_posts")
    .insert({ group_id: groupId, author_id: user.id, title, body })
    .select("id")
    .single();

  if (error || !post) {
    return { error: "Errore durante la pubblicazione." };
  }

  for (const photo of photos) {
    const path = `${user.id}/community/${post.id}/${Date.now()}-${safeStorageName(photo.name)}`;
    const { error: uploadError } = await supabase.storage.from("public-assets").upload(path, photo, {
      contentType: (await detectFileMime(photo)) ?? (photo.type || undefined),
    });
    if (!uploadError) {
      const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
      await supabase.from("community_post_photos").insert({ post_id: post.id, url: data.publicUrl });
    }
  }

  revalidatePath(communityPath(groupId));

  const { data: targets } = await supabase.rpc("get_community_post_push_targets", { p_post_id: post.id });
  const typedTargets = (targets as PushTarget[]) || [];
  if (typedTargets.length > 0) {
    const preview = (title || body.replace(/<[^>]+>/g, " ").trim()).slice(0, 120);
    const { expiredEndpoints } = await sendPushToTargets(typedTargets, {
      title: groupId ? "Nuovo post nel gruppo" : "Nuovo post nella community",
      body: preview || "Nuovo post",
      url: communityPath(groupId),
    });
    if (expiredEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }
  }

  return { error: undefined };
}

export async function likePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("community_post_likes").upsert(
    { post_id: postId, profile_id: user.id },
    { onConflict: "post_id,profile_id", ignoreDuplicates: true },
  );
}

export async function unlikePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("community_post_likes").delete().eq("post_id", postId).eq("profile_id", user.id);
}

export async function deletePost(groupId: string | null, postId: string) {
  const supabase = await createClient();
  await supabase.from("community_posts").delete().eq("id", postId);
  revalidatePath(communityPath(groupId));
}

export async function addComment(
  groupId: string | null,
  postId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Devi essere loggato." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Scrivi un commento prima di inviarlo." };

  const { error } = await supabase
    .from("community_comments")
    .insert({ post_id: postId, author_id: user.id, body });

  if (error) return { error: "Errore durante l'invio del commento." };

  revalidatePath(communityPath(groupId));
  return { error: undefined };
}

export async function deleteComment(groupId: string | null, commentId: string) {
  const supabase = await createClient();
  await supabase.from("community_comments").delete().eq("id", commentId);
  revalidatePath(communityPath(groupId));
}
