import { createClient } from "@/lib/supabase/server";
import type { ActivityTemplate } from "@/lib/types";
import LibraryGrid from "@/components/LibraryGrid";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("activity_templates")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="border-l-4 border-[#2b333e] pl-3 text-2xl font-semibold text-slate-900">Libreria</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Le attività che hai salvato per riusarle in altri viaggi. Per aggiungerne una, apri un&apos;attività
        in un viaggio e clicca l&apos;icona del segnalibro.
      </p>

      <LibraryGrid templates={(templates as ActivityTemplate[]) || []} />
    </div>
  );
}
