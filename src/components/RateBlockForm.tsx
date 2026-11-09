"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Trip } from "@/lib/types";
import { updateTripRateBlock } from "@/app/dashboard/trips/[id]/actions";
import SubmitButton from "@/components/SubmitButton";

const textareaClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

export default function RateBlockForm({ trip, hasAgencyTerms }: { trip: Trip; hasAgencyTerms: boolean }) {
  const action = updateTripRateBlock.bind(null, trip.id);
  const [, formAction] = useActionState(async (_prevState: null, formData: FormData) => {
    await action(formData);
    return null;
  }, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-xs text-slate-500">
        Box facoltativo con le voci incluse/escluse nella quota, da mostrare in fondo all&apos;itinerario del
        cliente (stile Tour Operator). Il testo dei Termini e Condizioni si scrive una volta sola nelle{" "}
        <Link href="/dashboard/settings" className="underline hover:text-slate-700">
          Impostazioni
        </Link>
        {!hasAgencyTerms && " (non ancora compilato)"}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rate_includes" className={labelClass}>
            La quota include
          </label>
          <textarea
            id="rate_includes"
            name="rate_includes"
            rows={5}
            defaultValue={trip.rate_includes ?? ""}
            placeholder={"Una voce per riga, es.\nHotel 4* a Venezia, 3 notti\nTransfer privato aeroporto-hotel"}
            className={textareaClass}
          />
        </div>
        <div>
          <label htmlFor="rate_excludes" className={labelClass}>
            La quota non include
          </label>
          <textarea
            id="rate_excludes"
            name="rate_excludes"
            rows={5}
            defaultValue={trip.rate_excludes ?? ""}
            placeholder={"Una voce per riga, es.\nVoli\nMance ed extra personali"}
            className={textareaClass}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="show_rate_block" defaultChecked={trip.show_rate_block} className="h-4 w-4" />
        Mostra questo box al cliente nell&apos;itinerario
      </label>

      <SubmitButton pendingLabel="Salvataggio…" className="w-fit rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
        Salva Tariffa &amp; Termini
      </SubmitButton>
    </form>
  );
}
