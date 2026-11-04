"use client";

import { useActionState } from "react";
import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import { clientSignup } from "./actions";

export default function ClientSignupPage() {
  const [state, formAction, pending] = useActionState(clientSignup, undefined);

  if (state?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf3e6] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#e6d7bb] bg-white p-8 text-center shadow-lg shadow-[#e6d7bb]/40">
          <AuthBrandHeader />
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Controlla la tua email</h1>
          <p className="text-sm text-slate-500">
            Ti abbiamo mandato un link di conferma. Clicca sul link e poi torna qui per accedere: troverai subito i
            tuoi viaggi, se la tua agenzia ha già usato questa email per te.
          </p>
          <Link href="/client/login" className="mt-6 inline-block text-sm font-medium text-[#2b333e] hover:underline">
            Vai al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf3e6] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#e6d7bb] bg-white p-8 shadow-lg shadow-[#e6d7bb]/40">
        <AuthBrandHeader />
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Area clienti</h1>
        <p className="mb-6 text-sm text-slate-500">
          Crea il tuo account con la stessa email che la tua agenzia ha usato per te: vedrai subito i tuoi viaggi.
        </p>

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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-[#2b333e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#1e242d] disabled:opacity-60"
          >
            {pending ? "Creazione account…" : "Registrati"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Hai già un account?{" "}
          <Link href="/client/login" className="font-medium text-[#2b333e] hover:underline">
            Accedi
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Sei un&apos;agenzia?{" "}
          <Link href="/signup" className="font-medium text-slate-500 hover:underline">
            Registrati qui
          </Link>
        </p>
      </div>
    </div>
  );
}
