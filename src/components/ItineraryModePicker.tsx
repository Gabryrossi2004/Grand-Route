"use client";

import { CalendarDays, ListChecks } from "lucide-react";
import type { ItineraryMode } from "@/lib/itineraryMode";

const OPTIONS: { value: ItineraryMode; title: string; text: string; Icon: typeof ListChecks }[] = [
  { value: "activities", title: "Per attività", text: "Una scheda per ogni attività, con orario, tipo e dettagli. La scelta più usata dai tour operator.", Icon: ListChecks },
  { value: "days", title: "Giornata intera", text: "Un unico blocco di testo per giorno, con tutte le attività elencate dentro.", Icon: CalendarDays },
];

// Come organizzare l'itinerario: una scheda per attività oppure un blocco unico per ogni giornata.
export default function ItineraryModePicker({
  value,
  onChange,
  name,
  id = "itinerary_mode",
}: {
  value: ItineraryMode;
  onChange: (value: ItineraryMode) => void;
  name?: string;
  id?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-slate-700">Come organizzare l&apos;itinerario</legend>
      <div role="radiogroup" id={id} className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map(({ value: v, title, text, Icon }) => {
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(v)}
              className={`flex min-w-0 items-start gap-2.5 rounded-lg border p-3 text-left transition ${
                on ? "border-[#233c5e] bg-[#233c5e]/5 ring-1 ring-[#233c5e]" : "border-slate-300 bg-white hover:border-[#cda876]"
              }`}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${on ? "text-[#233c5e]" : "text-slate-400"}`} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{title}</span>
                <span className="block text-xs text-slate-500">{text}</span>
              </span>
            </button>
          );
        })}
      </div>
      {name && <input type="hidden" name={name} value={value} />}
    </fieldset>
  );
}
