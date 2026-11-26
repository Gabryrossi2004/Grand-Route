"use client";

import { areaHref, PRO_LOGIN } from "@/lib/areas";
import { useActionState } from "react";
import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";
import { travelerSignup } from "../actions";

const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";

export default function TravelerSignupPage() {
  const [state, formAction, pending] = useActionState(travelerSignup, undefined);

  if (state?.success) {
    return (
      <AuthShell>
        <div className="text-center">
          <AuthBrandHeader />
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Controlla la tua email</h1>
          <p className="text-sm text-slate-500">Ti abbiamo mandato un link per confermare l&apos;indirizzo: aprilo e poi accedi.</p>
          <Link href="/clienti" className="mt-6 inline-block text-sm font-medium text-[#233c5e] hover:underline">
            Vai all&apos;accesso
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthBrandHeader />
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Organizza il tuo viaggio</h1>
      <p className="mb-6 text-sm text-slate-500">
        Crea itinerari, tieni valigia e spese, ricorda i viaggi sul mappamondo. Se vuoi, fai preparare il viaggio da un&apos;agenzia.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
            Nome e cognome
          </label>
          <input id="fullName" name="fullName" type="text" required className={field} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input id="email" name="email" type="email" required className={field} />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input id="password" name="password" type="password" required minLength={6} className={field} />
        </div>
        <label className="flex items-start gap-2 text-xs text-slate-500">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#233c5e] focus:ring-[#cda876]" />
          <span>
            Accetto i{" "}
            <Link href="/termini" target="_blank" className="font-medium text-[#233c5e] hover:underline">
              Termini di Servizio
            </Link>{" "}
            e l&apos;
            <Link href="/privacy" target="_blank" className="font-medium text-[#233c5e] hover:underline">
              Informativa sulla Privacy
            </Link>
          </span>
        </label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60">
          {pending ? "Registrazione…" : "Registrati"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Hai già un account?{" "}
        <Link href="/clienti" className="font-medium text-[#233c5e] hover:underline">
          Accedi
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">
        Ti ha invitato la tua agenzia?{" "}
        <Link href="/client/signup" className="font-medium text-slate-500 hover:underline">
          Area clienti
        </Link>
        {" · "}
        <a href={areaHref("pro", PRO_LOGIN)} className="font-medium text-slate-500 hover:underline">
          Sono un professionista
        </a>
      </p>
    </AuthShell>
  );
}
