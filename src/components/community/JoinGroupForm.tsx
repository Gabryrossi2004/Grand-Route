"use client";

import { useActionState } from "react";
import { joinGroupByToken } from "@/app/dashboard/community/groups/actions";

export default function JoinGroupForm() {
  const [state, formAction, pending] = useActionState(joinGroupByToken, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30">
      <h2 className="text-sm font-semibold text-slate-900">Unisciti a un gruppo</h2>
      <p className="text-xs text-slate-500">Incolla qui il link o il codice di invito che ti ha dato un&apos;altra agenzia.</p>
      <input
        type="text"
        name="token"
        required
        placeholder="Link o codice di invito"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-[#2b333e] px-4 py-2 text-sm font-semibold text-[#2b333e] transition hover:bg-[#f2e2c4] disabled:opacity-60"
      >
        {pending ? "Verifica…" : "Unisciti"}
      </button>
    </form>
  );
}
