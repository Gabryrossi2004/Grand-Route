"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createGroup(_prevState: { error?: string } | undefined, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Devi essere loggato." };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return { error: "Il nome del gruppo è obbligatorio." };

  const { data: group, error } = await supabase
    .from("community_groups")
    .insert({ name, description, created_by: user.id })
    .select("id")
    .single();

  if (error || !group) {
    return { error: "Errore durante la creazione del gruppo." };
  }

  revalidatePath("/dashboard/community/groups");
  redirect(`/dashboard/community/groups/${group.id}`);
}

export async function joinGroupByToken(_prevState: { error?: string } | undefined, formData: FormData) {
  const supabase = await createClient();
  const raw = String(formData.get("token") ?? "").trim();
  if (!raw) return { error: "Inserisci un link o un codice di invito." };

  const token = raw.split("/").filter(Boolean).pop() ?? raw;

  const { data: groupId, error } = await supabase.rpc("redeem_community_invite", { p_token: token });
  if (error || !groupId) {
    return { error: error?.message || "Invito non valido." };
  }

  revalidatePath("/dashboard/community/groups");
  redirect(`/dashboard/community/groups/${groupId}`);
}

export async function createInvite(groupId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const maxUsesRaw = String(formData.get("max_uses") ?? "").trim();
  const expiresInDaysRaw = String(formData.get("expires_in_days") ?? "").trim();

  const maxUses = maxUsesRaw ? Math.max(1, parseInt(maxUsesRaw, 10)) : null;
  const expiresAt = expiresInDaysRaw
    ? new Date(Date.now() + Math.max(1, parseInt(expiresInDaysRaw, 10)) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await supabase.from("community_group_invites").insert({
    group_id: groupId,
    created_by: user.id,
    max_uses: maxUses,
    expires_at: expiresAt,
  });

  revalidatePath(`/dashboard/community/groups/${groupId}`);
}

export async function revokeInvite(groupId: string, inviteId: string) {
  const supabase = await createClient();
  await supabase.from("community_group_invites").update({ revoked: true }).eq("id", inviteId);
  revalidatePath(`/dashboard/community/groups/${groupId}`);
}

export async function removeMember(groupId: string, profileId: string) {
  const supabase = await createClient();
  await supabase
    .from("community_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("profile_id", profileId);
  revalidatePath(`/dashboard/community/groups/${groupId}`);
}

export async function leaveGroup(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("community_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("profile_id", user.id);

  redirect("/dashboard/community/groups");
}

export async function deleteGroup(groupId: string) {
  const supabase = await createClient();
  await supabase.from("community_groups").delete().eq("id", groupId);
  redirect("/dashboard/community/groups");
}
