"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Client } from "@/lib/types";
import DateField from "@/components/DateField";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

// Campo testo che, come per una password, resta nascosto finché non lo
// riveli tu: evita di mostrare codice fiscale, documenti o indirizzo a chi
// ti guarda lo schermo da dietro le spalle. Il dato resta comunque cifrato
// nel database indipendentemente da questo (vedi src/lib/encryption.ts).
function MaskedField({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete="off"
          defaultValue={defaultValue}
          className={`${inputClass} pr-9`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          title={visible ? "Nascondi" : "Mostra"}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

export default function ClientDetailsFields({
  client,
  defaultOpen = false,
  summaryLabel = "Dati anagrafici e documenti (opzionali)",
}: {
  client?: Client;
  defaultOpen?: boolean;
  summaryLabel?: string;
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border border-[#e6d7bb] bg-slate-50 p-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">{summaryLabel}</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date_of_birth" className={labelClass}>
            Data di nascita
          </label>
          <DateField id="date_of_birth" name="date_of_birth" defaultValue={client?.date_of_birth ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="place_of_birth" className={labelClass}>
            Comune di nascita
          </label>
          <input
            id="place_of_birth"
            name="place_of_birth"
            defaultValue={client?.place_of_birth ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="nationality" className={labelClass}>
            Cittadinanza
          </label>
          <input
            id="nationality"
            name="nationality"
            defaultValue={client?.nationality ?? ""}
            className={inputClass}
          />
        </div>
        <MaskedField
          id="fiscal_code"
          name="fiscal_code"
          label="Codice fiscale"
          defaultValue={client?.fiscal_code ?? ""}
        />
        <div className="sm:col-span-2">
          <MaskedField
            id="residence_address"
            name="residence_address"
            label="Indirizzo di residenza"
            defaultValue={client?.residence_address ?? ""}
          />
        </div>
        <MaskedField
          id="id_card_number"
          name="id_card_number"
          label="Numero carta d'identità"
          defaultValue={client?.id_card_number ?? ""}
        />
        <div>
          <label htmlFor="id_card_expiry" className={labelClass}>
            Scadenza carta d&apos;identità
          </label>
          <DateField id="id_card_expiry" name="id_card_expiry" defaultValue={client?.id_card_expiry ?? ""} className={inputClass} />
        </div>
        <MaskedField
          id="passport_number"
          name="passport_number"
          label="Numero passaporto"
          defaultValue={client?.passport_number ?? ""}
        />
        <div>
          <label htmlFor="passport_expiry" className={labelClass}>
            Scadenza passaporto
          </label>
          <DateField id="passport_expiry" name="passport_expiry" defaultValue={client?.passport_expiry ?? ""} className={inputClass} />
        </div>
      </div>
    </details>
  );
}
