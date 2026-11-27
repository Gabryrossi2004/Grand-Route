import { cache } from "react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import { isBusinessKind, type BusinessKind } from "./kinds";
import { validateNetworkProfile, type FormRecord } from "./validate";

// Tipo di attività dell'account collegato. null = account più vecchio (agenzia) o migrazione 0061 non ancora eseguita.
export const getBusinessKind = cache(async (): Promise<BusinessKind | null> => {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();
  const companyId = (await getTeamContext())?.companyId ?? user.id;
  const { data, error } = await supabase.from("profiles").select("business_kind").eq("id", companyId).maybeSingle();
  if (error) return null;
  const k = (data as { business_kind?: string | null } | null)?.business_kind;
  return isBusinessKind(k) ? k : null;
});

// I dati dell'attività scritti alla registrazione viaggiano nei dati di accesso fino al primo ingresso
const getSignupDraft = cache(async (): Promise<{ kind: string; draft: FormRecord } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const meta = (data?.claims as { user_metadata?: Record<string, unknown> } | undefined)?.user_metadata;
  const draft = meta?.network_draft;
  const kind = meta?.business_kind;
  if (!draft || typeof draft !== "object" || typeof kind !== "string") return null;
  return { kind, draft: draft as FormRecord };
});

// Al primo ingresso trasforma i dati della registrazione in profilo professionale (in verifica).
// Si ferma subito, senza costi, quando non c'è nulla da trasferire.
export async function adoptSignupDraft(): Promise<void> {
  const found = await getSignupDraft();
  if (!found) return;
  const user = await getCachedUser();
  if (!user) return;
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase.from("network_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (readError) return; // migrazione 0061 non ancora eseguita
  if (!existing) {
    const checked = validateNetworkProfile(found.kind, found.draft);
    if (checked.ok) {
      const { error } = await supabase.from("network_profiles").insert({ user_id: user.id, ...checked.data, status: "in_verifica" });
      if (error) return;
    }
  }
  // i dati non servono più nei dati di accesso (appesantiscono ogni richiesta)
  await supabase.auth.updateUser({ data: { network_draft: null } });
}
