"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  // Area fornitori (guide, autisti, strutture…): stesso accesso, parole e collegamenti pensati per loro.
  // Dopo l'accesso ognuno finisce nella sua area in base al tipo di account.
  const supplier = params.get("area") === "fornitori";

  return (
    <AuthShell>
      <AuthBrandHeader />
        <h1 className="mb-1 text-xl font-semibold text-slate-900">{supplier ? "Accedi all'area fornitori" : "Accedi"}</h1>
        <p className="mb-6 text-sm text-slate-500">
          {supplier ? "Guide, autisti, strutture, esperienze e agenzie locali" : "Entra nel gestionale della tua agenzia o del tuo tour operator"}
        </p>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-[#233c5e] hover:underline">
                Password dimenticata?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60"
          >
            {pending ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Non hai un account?{" "}
          <Link href={supplier ? "/signup?tipo=guida" : "/signup"} className="font-medium text-[#233c5e] hover:underline">
            {supplier ? "Registrati come fornitore" : "Registrati"}
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          {supplier ? "Sei un'agenzia o un tour operator? " : "Sei una guida, un autista o una struttura? "}
          <Link href={supplier ? "/login" : "/login?area=fornitori"} className="font-medium hover:underline">
            {supplier ? "Accedi al gestionale" : "Area fornitori"}
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          Sei un cliente?{" "}
          <Link href="/client/login" className="font-medium hover:underline">
            Accedi qui
          </Link>
        </p>
    </AuthShell>
  );
}
