"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";
import type { Profile } from "@/lib/types";

export default function SettingsForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Tipo di account</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="account_type" value="individual" defaultChecked={profile.account_type === "individual"} />
            Viaggiatore privato
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="account_type" value="agency" defaultChecked={profile.account_type === "agency"} />
            Agenzia / Travel advisor
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="agency_name" className="mb-1 block text-sm font-medium text-slate-700">
          Nome agenzia (mostrato nella pagina pubblica del viaggio)
        </label>
        <input
          id="agency_name"
          name="agency_name"
          defaultValue={profile.agency_name ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>

      <div>
        <label htmlFor="brand_color" className="mb-1 block text-sm font-medium text-slate-700">
          Colore del brand
        </label>
        <input
          id="brand_color"
          name="brand_color"
          type="color"
          defaultValue={profile.brand_color ?? "#2563eb"}
          className="h-10 w-20 cursor-pointer rounded-md border border-slate-300"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Logo</label>
        {profile.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.logo_url} alt="Logo attuale" className="mb-2 h-12 rounded border border-slate-200 bg-white p-1" />
        )}
        <input
          type="file"
          name="logo"
          accept="image/*"
          className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Impostazioni salvate.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-[#2b333e] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e242d] disabled:opacity-60"
      >
        {pending ? "Salvataggio…" : "Salva impostazioni"}
      </button>
    </form>
  );
}
