"use client";

import { useActionState } from "react";
import { createGroup } from "@/app/dashboard/community/groups/actions";

export default function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30">
      <h2 className="text-sm font-semibold text-slate-900">Crea un nuovo gruppo</h2>
      <input
        type="text"
        name="name"
        required
        placeholder="Nome del gruppo"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
      />
      <textarea
        name="description"
        placeholder="Descrizione (opzionale)"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
      />
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
