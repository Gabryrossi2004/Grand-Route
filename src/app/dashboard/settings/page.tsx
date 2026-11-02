import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Impostazioni</h1>
      <SettingsForm profile={profile as Profile} />
    </div>
  );
}
