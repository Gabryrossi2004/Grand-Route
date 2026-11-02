"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  if (state?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Controlla la tua email</h1>
          <p className="text-sm text-slate-500">
            Ti abbiamo mandato un link di conferma. Clicca sul link e poi torna qui per accedere.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline">
            Vai al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Crea il tuo account</h1>
        <p className="mb-6 text-sm text-slate-500">Inizia a creare itinerari in pochi minuti</p>

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
              Nome e cognome
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Creazione account…" : "Registrati"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Hai già un account?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
