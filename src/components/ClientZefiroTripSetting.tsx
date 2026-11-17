"use client";

import { useState, useTransition } from "react";
import { setTripClientZefiro } from "@/app/dashboard/trips/[id]/actions";
import { ASSISTANT_NAME } from "@/lib/assistant";

// Per un viaggio: Zefiro risponde al cliente? "Come nelle Impostazioni" segue
// la scelta generale dell'agenzia.
export default function ClientZefiroTripSetting({ tripId, initial }: { tripId: string; initial: "default" | "on" | "off" }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: "default" | "on" | "off") {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setTripClientZefiro(tripId, next);
      if ("error" in result) {
        setValue(previous);
        setError(result.error ?? "Errore");
      }
    });
  }

  return (
    <div className="border-t border-[#f2e2c4] pt-3">
      <label htmlFor="trip_zefiro" className="mb-1 block text-sm font-medium text-slate-700">
        {ASSISTANT_NAME} risponde al cliente
      </label>
      <select
        id="trip_zefiro"
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value as "default" | "on" | "off")}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="default">Come nelle Impostazioni</option>
        <option value="on">Sì, per questo viaggio</option>
        <option value="off">No, per questo viaggio</option>
      </select>
      <p className="mt-1 text-xs text-slate-500">
        Il cliente può fargli domande sul suo viaggio, anche fuori orario. Le risposte usano il tuo budget giornaliero.
      </p>
      {error && (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
