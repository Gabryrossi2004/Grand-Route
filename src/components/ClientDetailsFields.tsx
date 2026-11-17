"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Client } from "@/lib/types";
import DateField from "@/components/DateField";
import { useI18n } from "@/components/I18nProvider";

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
  const { t } = useI18n();

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
          title={visible ? t("common.hide") : t("common.show")}
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
  summaryLabel,
}: {
  client?: Client;
  defaultOpen?: boolean;
  summaryLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <details open={defaultOpen} className="rounded-lg border border-[#e6d7bb] bg-slate-50 p-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">{summaryLabel ?? t("details.summaryOptional")}</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date_of_birth" className={labelClass}>
            {t("details.birthDate")}
          </label>
          <DateField id="date_of_birth" name="date_of_birth" defaultValue={client?.date_of_birth ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="place_of_birth" className={labelClass}>
            {t("details.birthPlace")}
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
            {t("details.nationality")}
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
          label={t("details.fiscalCode")}
          defaultValue={client?.fiscal_code ?? ""}
        />
        <div className="sm:col-span-2">
          <MaskedField
            id="residence_address"
            name="residence_address"
            label={t("details.address")}
            defaultValue={client?.residence_address ?? ""}
          />
        </div>
        <MaskedField
          id="id_card_number"
          name="id_card_number"
          label={t("details.idNumber")}
          defaultValue={client?.id_card_number ?? ""}
        />
        <div>
          <label htmlFor="id_card_expiry" className={labelClass}>
            {t("details.idExpiry")}
          </label>
          <DateField id="id_card_expiry" name="id_card_expiry" defaultValue={client?.id_card_expiry ?? ""} className={inputClass} />
        </div>
        <MaskedField
          id="passport_number"
          name="passport_number"
          label={t("details.passportNumber")}
          defaultValue={client?.passport_number ?? ""}
        />
        <div>
          <label htmlFor="passport_expiry" className={labelClass}>
            {t("details.passportExpiry")}
          </label>
          <DateField id="passport_expiry" name="passport_expiry" defaultValue={client?.passport_expiry ?? ""} className={inputClass} />
        </div>
      </div>
    </details>
  );
}
