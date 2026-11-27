"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { inviteMember, type InviteState } from "@/app/dashboard/team/actions";
import { ROLE_HINTS, ROLE_LABELS, TEAM_ROLES } from "@/lib/teamRoles";
import CopyLinkButton from "./CopyLinkButton";

// Invito di un collega: email + ruolo. Dopo l'invio mostra il link da copiare (utile se l'email non arriva)
export default function TeamInviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email del collega</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="nome@agenzia.it"
            className="w-full rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Ruolo</span>
          <select name="role" defaultValue="operativo" className="w-full rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]">
            {TEAM_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        {TEAM_ROLES.map((r) => (
          <li key={r}>
            <strong className="text-[#233c5e]">{ROLE_LABELS[r]}:</strong> {ROLE_HINTS[r]}
          </li>
        ))}
      </ul>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b2f4a] disabled:opacity-60"
      >
        <UserPlus size={16} aria-hidden /> {pending ? "Invio…" : "Invita"}
      </button>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.link && (
        <div className="rounded-2xl border border-[#cda876] bg-[#faf3e6] p-4 text-sm text-[#233c5e]">
          <p className="font-semibold">
            Invito pronto per {state.email}.{" "}
            {state.emailSent ? "Gli abbiamo mandato un'email." : "L'email non è partita: mandagli tu il link qui sotto."}
          </p>
          <p className="mt-1 break-all text-xs text-slate-600">{state.link}</p>
          <div className="mt-2">
            <CopyLinkButton link={state.link} />
          </div>
        </div>
      )}
    </form>
  );
}
