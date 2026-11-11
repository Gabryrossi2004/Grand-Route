import { createClient } from "@/lib/supabase/server";
import type { ActivityTemplate, PromptStyle } from "@/lib/types";
import LibraryTabs from "@/components/LibraryTabs";
import { seedDefaultPromptStylesIfEmpty } from "./actions";

export default async function LibraryPage() {
  await seedDefaultPromptStylesIfEmpty();

  const supabase = await createClient();
  const [{ data: templates }, { data: styles }] = await Promise.all([
    supabase.from("activity_templates").select("*").order("created_at", { ascending: false }),
    supabase.from("prompt_styles").select("*").order("created_at", { ascending: true }),
  ]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="border-l-4 border-[#233c5e] pl-3 text-2xl font-semibold text-slate-900">Libreria</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        I Blocchi sono le attività salvate per riusarle in altri viaggi (apri un&apos;attività e clicca l&apos;icona
        del segnalibro). Gli Stili sono invece istruzioni di tono da usare quando generi un itinerario con l&apos;AI.
      </p>

      <LibraryTabs
        templates={(templates as ActivityTemplate[]) || []}
        styles={(styles as PromptStyle[]) || []}
      />
    </div>
  );
}
