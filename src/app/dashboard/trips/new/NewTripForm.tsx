"use client";

import { useActionState } from "react";
import { createTrip } from "./actions";
import type { Client } from "@/lib/types";

export default function NewTripForm({ clients }: { clients: Client[] }) {
  const [state, formAction, pending] = useActionState(createTrip, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
          Titolo del viaggio *
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="Es. Luna di miele in Giappone"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="destination" className="mb-1 block text-sm font-medium text-slate-700">
          Destinazione
        </label>
        <input
          id="destination"
          name="destination"
          type="text"
          placeholder="Es. Giappone"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_date" className="mb-1 block text-sm font-medium text-slate-700">
            Data inizio
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="end_date" className="mb-1 block text-sm font-medium text-slate-700">
            Data fine
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {clients.length > 0 && (
        <div>
          <label htmlFor="client_id" className="mb-1 block text-sm font-medium text-slate-700">
            Cliente collegato (opzionale)
          </label>
          <select
            id="client_id"
            name="client_id"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Nessuno</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Creazione…" : "Crea viaggio"}
      </button>
    </form>
  );
}
