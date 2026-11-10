"use client";

import { useActionState } from "react";
import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.success) {
    return (
      <AuthShell>
        <div className="text-center">
          <AuthBrandHeader />
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Controlla la tua email</h1>
          <p className="text-sm text-slate-500">
            Se quell&apos;indirizzo è registrato, ti abbiamo mandato un link per scegliere una nuova password.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-[#233c5e] hover:underline">
            Torna al login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthBrandHeader />
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Password dimenticata</h1>
        <p className="mb-6 text-sm text-slate-500">
          Inserisci la tua email: ti mandiamo un link per scegliere una nuova password.
        </p>

        <form action={formAction} className="flex flex-col gap-4">
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

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60"
          >
            {pending ? "Invio in corso…" : "Invia il link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-[#233c5e] hover:underline">
            Torna al login
          </Link>
        </p>
    </AuthShell>
  );
}
