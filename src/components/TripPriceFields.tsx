"use client";

import { useState } from "react";
import type { PriceMode, Trip } from "@/lib/types";

export default function TripPriceFields({ trip }: { trip: Trip }) {
  const [priceMode, setPriceMode] = useState<PriceMode>(trip.price_mode);

  return (
    <div className="rounded-lg bg-slate-50 p-4 sm:col-span-2">
      <label htmlFor="price_mode" className="mb-1 block text-sm font-medium text-slate-700">
        Come mostrare il prezzo al cliente
      </label>
      <select
        id="price_mode"
        name="price_mode"
        value={priceMode}
        onChange={(e) => setPriceMode(e.target.value as PriceMode)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876] sm:w-auto"
      >
        <option value="nessuno">Senza costi (non mostrare nessun prezzo)</option>
        <option value="lordo">Prezzo lordo (un unico totale)</option>
        <option value="commissioni">Con commissioni esposte (costo + commissione separati)</option>
      </select>

      {priceMode === "lordo" && (
        <div className="mt-3 max-w-xs">
          <label htmlFor="price_amount" className="mb-1 block text-xs font-medium text-slate-600">
            Prezzo totale (€)
          </label>
          <input
            id="price_amount"
            name="price_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={trip.price_amount ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>
      )}

      {priceMode === "commissioni" && (
        <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
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
              defaultValue={trip.price_net ?? ""}
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
              defaultValue={trip.price_commission ?? ""}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
