"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Trip } from "@/lib/types";
import { updateTripEmergencyButton } from "@/app/dashboard/trips/[id]/actions";

export default function EmergencyButtonForm({ trip, hasEmergencyPhone }: { trip: Trip; hasEmergencyPhone: boolean }) {
  const action = updateTripEmergencyButton.bind(null, trip.id);
  const [, formAction] = useActionState(async (_prevState: null, formData: FormData) => {
    await action(formData);
    return null;
  }, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        Se attivo, il cliente vede un tasto &quot;Emergenza&quot; nella sua area riservata: aprirà WhatsApp con un
        messaggio già pronto da inviare al numero che hai impostato nelle{" "}
        <Link href="/dashboard/settings" className="underline hover:text-slate-700">
          Impostazioni
        </Link>
        {!hasEmergencyPhone && " (non ancora compilato)"}.
      </p>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="show_emergency_button"
          defaultChecked={trip.show_emergency_button}
          disabled={!hasEmergencyPhone}
        />
        Mostra il tasto emergenza al cliente per questo viaggio
      </label>

      {!hasEmergencyPhone && (
        <p className="text-xs text-amber-700">
          Inserisci prima un numero nelle Impostazioni per poter attivare questa opzione.
        </p>
      )}

      <button
        type="submit"
        disabled={!hasEmergencyPhone}
        className="w-fit rounded-md bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
      >
        Salva
      </button>
    </form>
  );
}
