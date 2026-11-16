import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Client, PromptStyle } from "@/lib/types";
import NewTripForm from "./NewTripForm";
import { isAvatarVisible } from "@/lib/assistant";

export default async function NewTripPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  const [{ data: clients }, { data: promptStyles }, { data: me }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name", { ascending: true }),
    supabase
      .from("prompt_styles")
      .select("*")
      .eq("owner_id", user?.id ?? "")
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("ai_preferences").eq("id", user?.id ?? "").maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-3xl font-medium tracking-tight text-[#233c5e]">Nuovo viaggio</h1>
      <NewTripForm clients={(clients as Client[]) || []} promptStyles={(promptStyles as PromptStyle[]) || []}
        showAiButton={!isAvatarVisible(me?.ai_preferences as Record<string, string> | null)}
      />
    </div>
  );
}
