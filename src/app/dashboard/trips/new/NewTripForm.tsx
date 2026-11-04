"use client";

import { useActionState, useState } from "react";
import { createTrip } from "./actions";
import type { Client, PriceMode } from "@/lib/types";

export default function NewTripForm({ clients }: { clients: Client[] }) {
  const [state, formAction, pending] = useActionState(createTrip, undefined);
  const [priceMode, setPriceMode] = useState<PriceMode>("nessuno");

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
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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

      <div className="rounded-md bg-slate-50 p-3">
        <label htmlFor="price_mode" className="mb-1 block text-sm font-medium text-slate-700">
          Come mostrare il prezzo al cliente
        </label>
        <select
          id="price_mode"
          name="price_mode"
          value={priceMode}
          onChange={(e) => setPriceMode(e.target.value as PriceMode)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        >
          <option value="nessuno">Senza costi (non mostrare nessun prezzo)</option>
          <option value="lordo">Prezzo lordo (un unico totale)</option>
          <option value="commissioni">Con commissioni esposte (costo + commissione separati)</option>
        </select>

        {priceMode === "lordo" && (
          <div className="mt-3">
            <label htmlFor="price_amount" className="mb-1 block text-xs font-medium text-slate-600">
              Prezzo totale (€)
            </label>
            <input
              id="price_amount"
              name="price_amount"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
            />
          </div>
        )}

        {priceMode === "commissioni" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="price_net" className="mb-1 block text-xs font-medium text-slate-600">
                Costo netto (€)
              </label>
              <input
                id="price_net"
                name="price_net"
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
              />
            </div>
            <div>
              <label htmlFor="price_commission" className="mb-1 block text-xs font-medium text-slate-600">
                Tua commissione (€)
              </label>
              <input
                id="price_commission"
                name="price_commission"
                type="number"
                step="0.01"
                min="0"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
              />
            </div>
          </div>
        )}
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-fit rounded-md bg-[#2b333e] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e242d] disabled:opacity-60"
      >
        {pending ? "Creazione…" : "Crea viaggio"}
      </button>
    </form>
  );
}
