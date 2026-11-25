import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";

// Account sospeso dall'amministrazione? Senza la migrazione 0062 nessuno è sospeso.
export const getSuspension = cache(async (): Promise<{ at: string; reason: string | null } | null> => {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("suspended_at, suspended_reason").eq("id", user.id).maybeSingle();
  if (error || !data) return null;
  const row = data as { suspended_at: string | null; suspended_reason: string | null };
  return row.suspended_at ? { at: row.suspended_at, reason: row.suspended_reason } : null;
});

export async function redirectIfSuspended(): Promise<void> {
  if (await getSuspension()) redirect("/sospeso");
}
