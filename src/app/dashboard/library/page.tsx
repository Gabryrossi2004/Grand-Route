import { createClient } from "@/lib/supabase/server";
import type { ActivityTemplate } from "@/lib/types";
import { activityTypes, detailFieldLabels } from "@/lib/activityTypes";
import { deleteTemplate } from "./actions";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("activity_templates")
    .select("*")
    .order("created_at", { ascending: false });

  const allTemplates = (templates as ActivityTemplate[]) || [];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Libreria</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Le attività che hai salvato per riusarle in altri viaggi. Per aggiungerne una, apri un&apos;attività
        in un viaggio e clicca &quot;Salva in libreria&quot;.
      </p>

      {allTemplates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">Non hai ancora salvato nessuna attività in libreria.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allTemplates.map((template) => {
            const meta = activityTypes[template.activity_type];
            const Icon = meta.icon;
            const detailEntries = Object.entries(template.details || {});

            return (
              <div
                key={template.id}
                style={{ borderLeftColor: meta.color, backgroundColor: meta.bg }}
                className="rounded-xl border-l-4 border-y border-r border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: meta.color }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                    >
                      <Icon size={14} />
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{template.title}</p>
                      <p className="text-xs text-slate-500">{meta.label}</p>
                    </div>
                  </div>
                  <form action={deleteTemplate.bind(null, template.id)}>
                    <button type="submit" className="shrink-0 text-xs text-red-500 hover:underline">
                      Elimina
                    </button>
                  </form>
                </div>

                {template.location && <p className="text-xs text-slate-500">{template.location}</p>}

                {detailEntries.length > 0 && (
                  <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    {detailEntries.map(([key, value]) => (
                      <div key={key} className="flex gap-1">
                        <dt className="font-medium">{detailFieldLabels[key] ?? key}:</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
