"use client";

import { useActionState } from "react";
import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf3e6] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#e6d7bb] bg-white p-8 shadow-lg shadow-[#e6d7bb]/40">
        <AuthBrandHeader />
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Accedi</h1>
        <p className="mb-6 text-sm text-slate-500">Entra nel tuo gestionale viaggi</p>

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
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-[#2b333e] hover:underline">
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
            className="mt-2 rounded-lg bg-[#2b333e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#1e242d] disabled:opacity-60"
          >
            {pending ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Non hai un account?{" "}
          <Link href="/signup" className="font-medium text-[#2b333e] hover:underline">
            Registrati
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Sei un cliente?{" "}
          <Link href="/client/login" className="font-medium hover:underline">
            Accedi qui
          </Link>
        </p>
      </div>
    </div>
  );
}
