"use client";

import { useActionState } from "react";
import Link from "next/link";
import { clientLogin } from "./actions";

export default function ClientLoginPage() {
  const [state, formAction, pending] = useActionState(clientLogin, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/50">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Area clienti</h1>
        <p className="mb-6 text-sm text-slate-500">Accedi per vedere i tuoi viaggi</p>

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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-blue-600 hover:underline">
                Password dimenticata?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Non hai un account?{" "}
          <Link href="/client/signup" className="font-medium text-blue-600 hover:underline">
            Registrati
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Sei un&apos;agenzia?{" "}
          <Link href="/login" className="font-medium text-slate-500 hover:underline">
            Accedi qui
          </Link>
        </p>
      </div>
    </div>
  );
}
