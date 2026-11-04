import type { Client } from "@/lib/types";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

export default function ClientDetailsFields({ client }: { client?: Client }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">
        Dati anagrafici e documenti (opzionali)
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date_of_birth" className={labelClass}>
            Data di nascita
          </label>
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            defaultValue={client?.date_of_birth ?? ""}
            className={inputClass}
          />
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
        <div>
          <label htmlFor="fiscal_code" className={labelClass}>
            Codice fiscale
          </label>
          <input
            id="fiscal_code"
            name="fiscal_code"
            defaultValue={client?.fiscal_code ?? ""}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="residence_address" className={labelClass}>
            Indirizzo di residenza
          </label>
          <input
            id="residence_address"
            name="residence_address"
            placeholder="Via, civico, città, CAP"
            defaultValue={client?.residence_address ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="id_card_number" className={labelClass}>
            Numero carta d&apos;identità
          </label>
          <input
            id="id_card_number"
            name="id_card_number"
            defaultValue={client?.id_card_number ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="id_card_expiry" className={labelClass}>
            Scadenza carta d&apos;identità
          </label>
          <input
            id="id_card_expiry"
            name="id_card_expiry"
            type="date"
            defaultValue={client?.id_card_expiry ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="passport_number" className={labelClass}>
            Numero passaporto
          </label>
          <input
            id="passport_number"
            name="passport_number"
            defaultValue={client?.passport_number ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="passport_expiry" className={labelClass}>
            Scadenza passaporto
          </label>
          <input
            id="passport_expiry"
            name="passport_expiry"
            type="date"
            defaultValue={client?.passport_expiry ?? ""}
            className={inputClass}
          />
        </div>
      </div>
    </details>
  );
}
