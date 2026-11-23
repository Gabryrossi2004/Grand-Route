"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTravelerTrip } from "../../../actions";

export default function DeleteTravelerTrip({ tripId }: { tripId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Eliminare questo viaggio con tutto il suo programma? Non si può annullare.")) return;
          start(async () => {
            const res = await deleteTravelerTrip(tripId);
            if (res?.error) setError(res.error);
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 size={13} /> {pending ? "Elimino…" : "Elimina il viaggio"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
