"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";
import { areaHref, CLIENT_LOGIN } from "@/lib/areas";
import { professionalLogin } from "./actions";

const field = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";

// Ingresso dei professionisti del turismo: agenzie, tour operator, agenzie locali, guide, autisti, strutture, esperienze.
export default function ProfessionalsPage() {
  return (
    <Suspense>
      <ProfessionalsLogin />
    </Suspense>
  );
}

function ProfessionalsLogin() {
  const [state, formAction, pending] = useActionState(professionalLogin, undefined);
  const next = useSearchParams().get("next") ?? "";
  const clientsUrl = areaHref("client", CLIENT_LOGIN);

  return (
    <AuthShell>
      <AuthBrandHeader area="pro" label="Professionisti" />
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Accedi</h1>
      <p className="mb-6 text-sm text-slate-500">Agenzie, tour operator, agenzie locali, guide, autisti, strutture e fornitori.</p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" className={field} />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
            <Link href="/forgot-password?area=professionisti" className="text-xs font-medium text-[#233c5e] hover:underline">Password dimenticata?</Link>
          </div>
          <input id="password" name="password" type="password" required autoComplete="current-password" className={field} />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
            {state.otherDoor && (
              <>
                {" "}
                <a href={clientsUrl} className="font-semibold underline">Vai all&apos;area clienti</a>.
              </>
            )}
          </p>
        )}

        <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60">
          {pending ? "Accesso in corso…" : "Accedi"}
        </button>
      </form>

      <div className="mt-6 rounded-xl bg-[#faf7ee] p-3 text-center text-sm text-slate-600">
        <p className="font-medium text-slate-800">Prima volta?</p>
        <p className="mt-1">
          <Link href="/signup" className="font-semibold text-[#233c5e] hover:underline">Registra la tua agenzia o il tuo tour operator</Link>
        </p>
        <p className="mt-1">
          <Link href="/signup?tipo=guida" className="font-semibold text-[#233c5e] hover:underline">Registrati come guida, autista, struttura o fornitore</Link>
        </p>
      </div>
      <p className="mt-5 text-center text-xs text-slate-500">
        Sei un cliente o un viaggiatore?{" "}
        <a href={clientsUrl} className="font-medium hover:underline">Area clienti</a>
      </p>
    </AuthShell>
  );
}
