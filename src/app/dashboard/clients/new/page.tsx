"use client";

import { useActionState } from "react";
import { createClientRecord } from "../actions";
import ClientDetailsFields from "@/components/ClientDetailsFields";

export default function NewClientPage() {
  const [state, formAction, pending] = useActionState(createClientRecord, undefined);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-3xl font-medium tracking-tight text-[#233c5e]">Nuovo cliente</h1>
      <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-[#e6d7bb] bg-white p-6">
        <div>
          <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-slate-700">
            Nome e cognome *
          </label>
          <input
            id="full_name"
            name="full_name"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
            Telefono
          </label>
          <input
            id="phone"
            name="phone"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
        <div>
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
            Note
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>

        <ClientDetailsFields />

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 w-fit rounded-md bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
        >
          {pending ? "Creazione…" : "Crea cliente"}
        </button>
      </form>
    </div>
  );
}
