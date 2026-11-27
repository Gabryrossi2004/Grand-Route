"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { joinTeamAsCurrentUser, joinTeamSignup, type JoinState } from "./actions";

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";

// Registrazione del collaboratore: l'email è quella dell'invito, si sceglie solo nome e password
export function JoinSignupForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinTeamSignup.bind(null, token), undefined);
  if (state?.checkEmail) {
    return (
      <div className="rounded-xl border border-[#cda876] bg-[#fdf6e6] px-4 py-3 text-sm text-[#233c5e]">
        <p className="font-semibold">Controlla la tua email</p>
        <p className="mt-1">
          Ti abbiamo mandato un link di conferma a {email}. Dopo averlo aperto,{" "}
          <Link href="/professionisti" className="font-medium underline">
            accedi
          </Link>{" "}
          con la tua email e la password: entrerai direttamente nella squadra.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input value={email} readOnly className={`${input} bg-slate-50 text-slate-600`} />
      </div>
      <div>
        <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">Nome e cognome</label>
        <input id="fullName" name="fullName" required autoComplete="name" className={input} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Scegli una password</label>
        <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" className={input} />
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300" />
        <span>
          Ho letto e accetto i{" "}
          <Link href="/termini" target="_blank" className="font-medium text-[#233c5e] hover:underline">Termini di Servizio</Link> e l&apos;
          <Link href="/privacy" target="_blank" className="font-medium text-[#233c5e] hover:underline">Informativa sulla Privacy</Link>.
        </span>
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17283f] disabled:opacity-60"
      >
        {pending ? "Un attimo…" : "Entra nella squadra"}
      </button>
    </form>
  );
}

// Già collegato: un tocco per entrare
export function JoinAsCurrentUser({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await joinTeamAsCurrentUser(token);
            if (res?.error) setError(res.error);
          })
        }
        className="rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17283f] disabled:opacity-60"
      >
        {pending ? "Un attimo…" : "Entra nella squadra"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
