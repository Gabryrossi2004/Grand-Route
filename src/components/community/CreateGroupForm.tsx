"use client";

import { useActionState, useState } from "react";
import { createGroup } from "@/app/dashboard/community/groups/actions";
import { COMMUNITY_CATEGORIES } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";

export default function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, undefined);
  const [visibility, setVisibility] = useState("open");

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30">
      <h2 className="text-sm font-semibold text-slate-900">Crea un nuovo gruppo</h2>
      <input type="text" name="name" required maxLength={80} placeholder="Nome del gruppo (es. Hotel in Sicilia)" className={inputClass} />
      <textarea name="description" placeholder="Di cosa si parla? (facoltativo)" rows={2} className={inputClass} />
      <select name="category" defaultValue="altro" className={inputClass}>
        {COMMUNITY_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <div className="flex flex-col gap-1.5 text-sm">
        <label className="flex items-start gap-2">
          <input type="radio" name="visibility" value="open" checked={visibility === "open"} onChange={() => setVisibility("open")} className="mt-1" />
          <span>
            <strong>Aperto</strong> — compare in vetrina, tutti i professionisti lo leggono e possono entrare con un clic.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="visibility" value="private" checked={visibility === "private"} onChange={() => setVisibility("private")} className="mt-1" />
          <span>
            <strong>Privato</strong> — non compare in vetrina, si entra solo con il tuo invito.
          </span>
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60"
      >
        {pending ? "Creazione…" : "Crea gruppo"}
      </button>
    </form>
  );
}
