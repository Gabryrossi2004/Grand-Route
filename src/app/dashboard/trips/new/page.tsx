import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import type { Client, PromptStyle } from "@/lib/types";
import NewTripForm from "./NewTripForm";

// La generazione con Zefiro può richiedere qualche decina di secondi (tre proposte in parallelo)
export const maxDuration = 60;

export default async function NewTripPage() {
  const supabase = await createClient();
  // Dati dell'agenzia (per un collaboratore: quelli dell'agenzia in cui lavora)
  const companyId = (await getTeamContext())?.companyId ?? "";
  const [{ data: clients }, { data: promptStyles }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name", { ascending: true }),
    supabase.from("prompt_styles").select("*").eq("owner_id", companyId).order("created_at", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-3xl font-medium tracking-tight text-[#233c5e]">Nuovo viaggio</h1>
      <NewTripForm clients={(clients as Client[]) || []} promptStyles={(promptStyles as PromptStyle[]) || []} />
    </div>
  );
}
