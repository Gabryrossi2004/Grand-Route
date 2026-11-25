"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { isBusinessKind, isTradeKind } from "@/lib/network/kinds";
import { formToRecord, validateNetworkProfile } from "@/lib/network/validate";
import { getBusinessKind } from "@/lib/network/server";

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
