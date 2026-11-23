import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { ActivityTemplate, PromptStyle } from "@/lib/types";
import LibraryTabs from "@/components/LibraryTabs";
import { seedDefaultPromptStylesIfEmpty } from "./actions";
import { listAgencyItineraries } from "@/lib/actions/agencyItineraries";
import { ASSISTANT_NAME } from "@/lib/assistant";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await seedDefaultPromptStylesIfEmpty();
  const { tab } = await searchParams;

  const supabase = await createClient();
  const user = await getCachedUser();
  const [{ data: templates }, { data: styles }, itineraries, { data: trips }] = await Promise.all([
    supabase.from("activity_templates").select("*").order("created_at", { ascending: false }),
    supabase.from("prompt_styles").select("*").order("created_at", { ascending: true }),
    listAgencyItineraries(),
    supabase
      .from("trips")
      .select("id, title, destination")
      .eq("owner_id", user?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Libreria</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        I Blocchi sono le attività salvate per riusarle in altri viaggi (apri un&apos;attività e clicca l&apos;icona
        del segnalibro). Gli Itinerari sono i vostri programmi completi, che compaiono nelle schede paese e nelle proposte
        di {ASSISTANT_NAME}. Gli Stili sono istruzioni di tono da usare quando chiedi un itinerario a {ASSISTANT_NAME}.
      </p>

      <LibraryTabs
        templates={(templates as ActivityTemplate[]) || []}
        styles={(styles as PromptStyle[]) || []}
        itineraries={itineraries.ok ? itineraries.items : []}
        itinerariesNotReady={itineraries.ok ? null : itineraries.error}
        trips={(trips ?? []) as { id: string; title: string; destination: string | null }[]}
        initialTab={tab === "itinerari" || tab === "stili" ? tab : "blocchi"}
      />
    </div>
  );
}
