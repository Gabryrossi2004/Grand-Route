"use client";

import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import type { ActivityTemplate } from "@/lib/types";
import { activityTypes, detailFieldLabel } from "@/lib/activityTypes";
import { deleteTemplate } from "@/app/dashboard/library/actions";

export default function LibraryGrid({
  templates,
  compact = false,
}: {
  templates: ActivityTemplate[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = templates.filter((template) => {
    const haystack = `${template.title} ${template.location ?? ""} ${activityTypes[template.activity_type].label}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div>
      {templates.length > 0 && (
        <div className="relative mb-5 max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca nella libreria…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
          />
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">Non hai ancora salvato nessuna attività in libreria.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun risultato per &quot;{query}&quot;.</p>
      ) : (
        <div className={`grid gap-4 ${compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {filtered.map((template) => {
            const meta = activityTypes[template.activity_type];
            const Icon = meta.icon;
            const detailEntries = Object.entries(template.details || {});

            return (
              <div
                key={template.id}
                style={{ borderLeftColor: meta.color, backgroundColor: meta.bg }}
                className="rounded-xl border-l-4 border-y border-r border-[#e6d7bb] bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: meta.color }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                    >
                      <Icon size={14} weight="light" />
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{template.title}</p>
                      <p className="text-xs text-slate-500">{meta.label}</p>
                    </div>
                  </div>
                  <form action={deleteTemplate.bind(null, template.id)}>
                    <button
                      type="submit"
                      title="Elimina"
                      className="flex shrink-0 items-center text-xs text-red-500 hover:underline"
                    >
                      <Trash2 size={13} />
                    </button>
                  </form>
                </div>

                {template.location && <p className="text-xs text-slate-500">{template.location}</p>}

                {detailEntries.length > 0 && (
                  <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    {detailEntries.map(([key, value]) => (
                      <div key={key} className="flex gap-1">
                        <dt className="font-medium">{detailFieldLabel(template.activity_type, key)}:</dt>
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
