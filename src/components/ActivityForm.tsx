"use client";

import { useState } from "react";
import type { ActivityDetails, ActivityTemplate, ActivityType } from "@/lib/types";
import { activityTypeOptions, detailFields } from "@/lib/activityTypes";

export default function ActivityForm({
  action,
  templates,
}: {
  action: (formData: FormData) => void;
  templates: ActivityTemplate[];
}) {
  const [activityType, setActivityType] = useState<ActivityType>("altro");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState<ActivityDetails>({});
  const [templateId, setTemplateId] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  const availableTemplates = templates.filter((t) => t.activity_type === activityType);
  const fields = detailFields[activityType];

  function changeType(newType: ActivityType) {
    setActivityType(newType);
    setDetails({});
    setTemplateId("");
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setTitle(template.title);
    setLocation(template.location ?? "");
    setDescription(template.description ?? "");
    setDetails(template.details ?? {});
  }

  function resetAll(formEl: HTMLFormElement) {
    setActivityType("altro");
    setTitle("");
    setLocation("");
    setDescription("");
    setDetails({});
    setTemplateId("");
    setSaveToLibrary(false);
    formEl.reset();
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const formEl = e.currentTarget;
        setTimeout(() => resetAll(formEl), 0);
      }}
      className="flex flex-col gap-2 border-t border-slate-100 pt-3"
    >
      <input type="hidden" name="details" value={JSON.stringify(details)} />

      <div className="grid gap-2 sm:grid-cols-[100px_140px_1fr]">
        <input
          name="start_time"
          type="time"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        />
        <select
          name="activity_type"
          value={activityType}
          onChange={(e) => changeType(e.target.value as ActivityType)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        >
          {activityTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {availableTemplates.length > 0 ? (
          <select
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Scrivi da zero…</option>
            {availableTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                Dalla libreria: {template.title}
              </option>
            ))}
          </select>
        ) : (
          <span className="flex items-center text-xs text-slate-400">
            Nessuna attività di questo tipo in libreria
          </span>
        )}
      </div>

      <input
        name="title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titolo attività (es. Check-in hotel)"
        required
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
      />
      <input
        name="location"
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Luogo (opzionale)"
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
      />
      <textarea
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrizione (opzionale)"
        rows={2}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
      />

      {fields.length > 0 && (
        <div className="grid gap-2 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-medium text-slate-600">{field.label}</label>
              {field.type === "select" ? (
                <select
                  value={details[field.key] ?? ""}
                  onChange={(e) => setDetails({ ...details, [field.key]: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">—</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={details[field.key] ?? ""}
                  onChange={(e) => setDetails({ ...details, [field.key]: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          name="save_to_library"
          checked={saveToLibrary}
          onChange={(e) => setSaveToLibrary(e.target.checked)}
        />
        Salva questa attività nella libreria per riusarla in altri viaggi
      </label>

      <button
        type="submit"
        className="w-fit rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        + Aggiungi attività
      </button>
    </form>
  );
}
