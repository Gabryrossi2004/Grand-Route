import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Client, PromptStyle } from "@/lib/types";
import NewTripForm from "./NewTripForm";

export default async function NewTripPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  const [{ data: clients }, { data: promptStyles }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name", { ascending: true }),
    supabase
      .from("prompt_styles")
      .select("*")
      .eq("owner_id", user?.id ?? "")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-3xl font-medium tracking-tight text-[#233c5e]">Nuovo viaggio</h1>
      <NewTripForm clients={(clients as Client[]) || []} promptStyles={(promptStyles as PromptStyle[]) || []} />
    </div>
  );
}
