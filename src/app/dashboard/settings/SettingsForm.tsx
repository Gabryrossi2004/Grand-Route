"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";
import type { Profile } from "@/lib/types";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import BrandColorField from "./BrandColorField";

// canEditAgency = false per i collaboratori non titolari: i dati dell'agenzia si vedono ma non si cambiano
export default function SettingsForm({ profile, canEditAgency = true }: { profile: Profile; canEditAgency?: boolean }) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-xl border border-[#e6d7bb] bg-white p-6">
      {!canEditAgency && (
        <p className="rounded-lg bg-[#faf3e6] px-3 py-2 text-xs text-[#6b5f4a]">
          Nome, colori, termini e numero d&apos;emergenza dell&apos;agenzia li cambia il titolare. Qui puoi scegliere il testo e le notifiche che preferisci.
        </p>
      )}
      <fieldset disabled={!canEditAgency} className="flex flex-col gap-5 disabled:opacity-60">
      <div>
        <label htmlFor="business_kind" className="mb-1 block text-sm font-medium text-slate-700">
          Tipo di attività
        </label>
        <select
          id="business_kind"
          name="business_kind"
          defaultValue={profile.business_kind ?? "agenzia"}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876] sm:w-80"
        >
          <option value="agenzia">Agenzia di viaggi</option>
          <option value="tour_operator">Tour operator</option>
          <option value="dmc">Agenzia locale (DMC)</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">Serve a mostrarti le sezioni giuste e a presentarti agli altri professionisti nella sezione Partner.</p>
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

      <BrandColorField defaultColor={profile.brand_color ?? "#233c5e"} logoUrl={profile.logo_url} />
      </fieldset>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Dimensione del testo</label>
        <p className="mb-2 text-xs text-slate-500">Si applica a tutte le pagine del gestionale (non all&apos;itinerario che vede il cliente).</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="ui_font_size"
              value="normale"
              defaultChecked={profile.ui_font_size === "normale" || !profile.ui_font_size}
            />
            Normale
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="ui_font_size" value="grande" defaultChecked={profile.ui_font_size === "grande"} />
            Grande
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="ui_font_size"
              value="molto_grande"
              defaultChecked={profile.ui_font_size === "molto_grande"}
            />
            Molto grande
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="ui_font_family" className="mb-1 block text-sm font-medium text-slate-700">
          Stile del carattere
        </label>
        <select
          id="ui_font_family"
          name="ui_font_family"
          defaultValue={profile.ui_font_family ?? "predefinito"}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        >
          <option value="predefinito">Predefinito</option>
          <option value="leggibile">Leggibile (più chiaro e spazioso)</option>
          <option value="classico">Classico (con grazie)</option>
        </select>
      </div>

      <fieldset disabled={!canEditAgency} className="flex flex-col gap-5 disabled:opacity-60">
      <div>
        <label htmlFor="terms_and_conditions" className="mb-1 block text-sm font-medium text-slate-700">
          Termini e Condizioni standard
        </label>
        <p className="mb-2 text-xs text-slate-500">
          Testo riutilizzato in tutti i viaggi per cui attivi il blocco &quot;Tariffa &amp; Termini&quot; (es. politica
          di cancellazione, modalità di pagamento, responsabilità). Lo scrivi una volta sola qui.
        </p>
        <textarea
          id="terms_and_conditions"
          name="terms_and_conditions"
          rows={8}
          defaultValue={profile.terms_and_conditions ?? ""}
          placeholder="Es. È richiesto un acconto del 25% per confermare la prenotazione..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>

      <div>
        <label htmlFor="emergency_phone" className="mb-1 block text-sm font-medium text-slate-700">
          Numero WhatsApp per le emergenze
        </label>
        <p className="mb-2 text-xs text-slate-500">
          Se lo inserisci, puoi attivare per singolo viaggio un tasto &quot;Emergenza&quot; nell&apos;area clienti: il
          cliente apre WhatsApp con un messaggio già pronto da inviarti a questo numero.
        </p>
        <input
          id="emergency_phone"
          name="emergency_phone"
          type="tel"
          defaultValue={profile.emergency_phone ?? ""}
          placeholder="+39 333 1234567"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>
      </fieldset>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Notifiche push</label>
        <p className="mb-2 text-xs text-slate-500">
          Scegli di cosa vuoi essere avvisato su questo e sugli altri tuoi dispositivi.
        </p>
        <div className="mb-3 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notify_trips" defaultChecked={profile.notify_trips ?? true} />
            Partenze imminenti dei tuoi viaggi
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notify_community" defaultChecked={profile.notify_community ?? true} />
            Nuovi post nella community (bacheca e gruppi)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notify_emergencies" defaultChecked={profile.notify_emergencies ?? true} />
            Emergenze segnalate dai clienti
          </label>
        </div>
        <PushNotificationToggle />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-600">Impostazioni salvate.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
      >
        {pending ? "Salvataggio…" : "Salva impostazioni"}
      </button>
    </form>
  );
}
