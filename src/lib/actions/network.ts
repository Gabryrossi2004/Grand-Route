"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { isBusinessKind, isTradeKind } from "@/lib/network/kinds";
import { formToRecord, validateNetworkProfile } from "@/lib/network/validate";
import { getBusinessKind } from "@/lib/network/server";
import { BRAND_COLORS, FILES_BUCKET, MAX_FILES, MAX_GALLERY, MEDIA_BUCKET } from "@/lib/network/media";

type Result = { ok?: boolean; error?: string; errors?: Record<string, string> };

const NOT_READY = "Per usare la Rete serve l'aggiornamento del database (migrazione 0061).";
const rpcMessage = (m: string | undefined) => (m && !/function|relation|schema cache/i.test(m) ? m : NOT_READY);

// Salva (o crea) il profilo professionale dell'account collegato
export async function saveNetworkProfile(_prev: Result | undefined, formData: FormData): Promise<Result> {
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const kindFromProfile = await getBusinessKind();
  const kindField = String(formData.get("kind") ?? "");
  // i fornitori restano del loro tipo; chi vende (agenzia, tour operator, agenzia locale) può scegliere tra questi tre
  const fromForm = isBusinessKind(kindField) ? kindField : null;
  const kind =
    kindFromProfile && !isTradeKind(kindFromProfile)
      ? kindFromProfile
      : fromForm && isTradeKind(fromForm)
        ? fromForm
        : (kindFromProfile ?? "agenzia");
  const checked = validateNetworkProfile(kind, formToRecord(formData));
  if (!checked.ok) return { error: "Controlla i campi evidenziati.", errors: checked.errors };

  const supabase = await createClient();
  const listed = formData.get("listed") === "on";
  const { data: existing, error: readError } = await supabase.from("network_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (readError) return { error: NOT_READY };
  const write = existing
    ? await supabase.from("network_profiles").update({ ...checked.data, listed }).eq("user_id", user.id)
    : await supabase.from("network_profiles").insert({ user_id: user.id, ...checked.data, listed, status: "in_verifica" });
  if (write.error) return { error: "Non sono riuscito a salvare. Riprova." };
  // un'agenzia che completa il profilo sceglie anche il tipo di attività
  if (kind !== kindFromProfile && isTradeKind(kind)) await supabase.from("profiles").update({ business_kind: kind }).eq("id", user.id);
  revalidatePath("/rete", "layout");
  return { ok: true };
}

export async function sendNetworkContact(toUser: string, message: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_send_contact", { p_to: toUser, p_message: message });
  if (error) return { error: rpcMessage(error.message) };
  revalidatePath("/rete/messaggi");
  return { ok: true };
}

export async function reviewNetworkProfile(reviewed: string, positive: boolean | null): Promise<Result> {
  const supabase = await createClient();
  const { error } = positive === null
    ? await supabase.rpc("network_remove_review", { p_reviewed: reviewed })
    : await supabase.rpc("network_review", { p_reviewed: reviewed, p_positive: positive });
  if (error) return { error: rpcMessage(error.message) };
  revalidatePath(`/rete/${reviewed}`);
  return { ok: true };
}

// Verifica (amministratori)
export async function setNetworkStatus(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) return;
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["verificato", "rifiutato", "sospeso", "in_verifica"].includes(status)) return;
  await supabase.from("network_profiles").update({ status, status_note: note }).eq("user_id", userId);
  revalidatePath("/dashboard/admin/rete");
}

// ============================================================
// Vetrina: copertina, logo, foto, slogan, colore, listini
// ============================================================
const NOT_READY_SHOWCASE = "Per la vetrina serve l'aggiornamento del database (migrazione 0064).";
const ownPath = (userId: string, path: string) => path.startsWith(`${userId}/`) && !path.includes("..") && path.length <= 300;

async function currentShowcase() {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("network_profiles").select("cover_path, logo_path, gallery").eq("user_id", user.id).maybeSingle();
  if (error) return { user, supabase, row: null, notReady: true as const };
  return { user, supabase, row: data as { cover_path: string | null; logo_path: string | null; gallery: string[] | null } | null, notReady: false as const };
}

// Toglie dalla cartella un file che non serve più (solo quelli caricati da noi, non le foto di prova)
async function dropMedia(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, path: string | null | undefined) {
  if (path && ownPath(userId, path)) await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}

export async function saveShowcaseText(formData: FormData): Promise<Result> {
  const ctx = await currentShowcase();
  if (!ctx) return { error: "Sessione scaduta: accedi di nuovo." };
  if (ctx.notReady || !ctx.row) return { error: ctx.notReady ? NOT_READY_SHOWCASE : "Salva prima i dati dell'attività, poi personalizza la vetrina." };
  const tagline = String(formData.get("tagline") ?? "").trim().slice(0, 90) || null;
  const color = String(formData.get("brand_color") ?? "");
  const brand_color = BRAND_COLORS.some((c) => c.value === color) ? color : null;
  const { error } = await ctx.supabase.from("network_profiles").update({ tagline, brand_color }).eq("user_id", ctx.user.id);
  if (error) return { error: "Non sono riuscito a salvare. Riprova." };
  revalidatePath("/rete", "layout");
  return { ok: true };
}

export async function setShowcaseImage(which: "cover" | "logo", path: string | null): Promise<Result> {
  const ctx = await currentShowcase();
  if (!ctx) return { error: "Sessione scaduta: accedi di nuovo." };
  if (ctx.notReady || !ctx.row) return { error: ctx.notReady ? NOT_READY_SHOWCASE : "Salva prima i dati dell'attività." };
  if (path !== null && !ownPath(ctx.user.id, path)) return { error: "Dati non validi." };
  const column = which === "cover" ? "cover_path" : "logo_path";
  const old = which === "cover" ? ctx.row.cover_path : ctx.row.logo_path;
  const { error } = await ctx.supabase.from("network_profiles").update({ [column]: path }).eq("user_id", ctx.user.id);
  if (error) return { error: "Non sono riuscito a salvare. Riprova." };
  if (old && old !== path) await dropMedia(ctx.supabase, ctx.user.id, old);
  revalidatePath("/rete", "layout");
  return { ok: true };
}

export async function addGalleryPhoto(path: string): Promise<Result> {
  const ctx = await currentShowcase();
  if (!ctx) return { error: "Sessione scaduta: accedi di nuovo." };
  if (ctx.notReady || !ctx.row) return { error: ctx.notReady ? NOT_READY_SHOWCASE : "Salva prima i dati dell'attività." };
  if (!ownPath(ctx.user.id, path)) return { error: "Dati non validi." };
  const gallery = ctx.row.gallery ?? [];
  if (gallery.length >= MAX_GALLERY) return { error: `Puoi tenere al massimo ${MAX_GALLERY} foto nella galleria.` };
  const { error } = await ctx.supabase.from("network_profiles").update({ gallery: [...gallery, path] }).eq("user_id", ctx.user.id);
  if (error) return { error: "Non sono riuscito a salvare. Riprova." };
  revalidatePath("/rete", "layout");
  return { ok: true };
}

export async function removeGalleryPhoto(path: string): Promise<Result> {
  const ctx = await currentShowcase();
  if (!ctx) return { error: "Sessione scaduta: accedi di nuovo." };
  if (ctx.notReady || !ctx.row) return { error: NOT_READY_SHOWCASE };
  const gallery = (ctx.row.gallery ?? []).filter((p) => p !== path);
  const { error } = await ctx.supabase.from("network_profiles").update({ gallery }).eq("user_id", ctx.user.id);
  if (error) return { error: "Non sono riuscito a salvare. Riprova." };
  await dropMedia(ctx.supabase, ctx.user.id, path);
  revalidatePath("/rete", "layout");
  return { ok: true };
}

export async function addNetworkFile(input: { title: string; path: string; size: number; mime: string; visibility: "rete" | "partner" }): Promise<Result> {
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const title = input.title.trim().slice(0, 80);
  if (title.length < 2 || !ownPath(user.id, input.path)) return { error: "Scrivi un titolo per il documento." };
  const supabase = await createClient();
  const { count, error: countError } = await supabase.from("network_files").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (countError) return { error: "Per i listini serve l'aggiornamento del database (migrazione 0064)." };
  if ((count ?? 0) >= MAX_FILES) return { error: `Puoi tenere al massimo ${MAX_FILES} documenti.` };
  const { error } = await supabase.from("network_files").insert({
    user_id: user.id,
    title,
    path: input.path,
    size_bytes: Math.min(Math.max(0, Math.round(input.size)), 2_000_000_000),
    mime: input.mime.slice(0, 100),
    visibility: input.visibility === "partner" ? "partner" : "rete",
  });
  if (error) return { error: "Non sono riuscito a salvare il documento. Riprova." };
  revalidatePath("/rete", "layout");
  return { ok: true };
}

export async function setNetworkFileVisibility(id: string, visibility: "rete" | "partner"): Promise<Result> {
  const user = await getCachedUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return { error: "Dati non validi." };
  const supabase = await createClient();
  const { error } = await supabase.from("network_files").update({ visibility: visibility === "partner" ? "partner" : "rete" }).eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Non sono riuscito a salvare. Riprova." };
  revalidatePath("/rete", "layout");
  return { ok: true };
}

export async function removeNetworkFile(id: string): Promise<Result> {
  const user = await getCachedUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return { error: "Dati non validi." };
  const supabase = await createClient();
  const { data } = await supabase.from("network_files").select("path").eq("id", id).eq("user_id", user.id).maybeSingle();
  const { error } = await supabase.from("network_files").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Non sono riuscito a cancellare. Riprova." };
  const path = (data as { path?: string } | null)?.path;
  if (path && ownPath(user.id, path)) await supabase.storage.from(FILES_BUCKET).remove([path]);
  revalidatePath("/rete", "layout");
  return { ok: true };
}

// ============================================================
// Collaborazioni
// ============================================================
export async function requestCollaboration(toUser: string, message: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_collab_request", { p_to: toUser, p_message: message });
  if (error) return { error: rpcMessage(error.message) };
  revalidatePath("/rete", "layout");
  revalidatePath("/dashboard/suppliers");
  return { ok: true };
}

export async function respondCollaboration(id: string, accept: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_collab_respond", { p_id: id, p_accept: accept });
  if (error) return { error: rpcMessage(error.message) };
  revalidatePath("/rete", "layout");
  revalidatePath("/dashboard/suppliers");
  return { ok: true };
}

export async function endCollaboration(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_collab_end", { p_id: id });
  if (error) return { error: rpcMessage(error.message) };
  revalidatePath("/rete", "layout");
  return { ok: true };
}
