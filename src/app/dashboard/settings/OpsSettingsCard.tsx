"use client";

import { useState } from "react";
import { setOpsImport } from "./actions";

// Scheda operativa «day by day»: importazione dei servizi dagli itinerari (per i tour operator)
export default function OpsSettingsCard({ initiallyOn, initiallyAuto }: { initiallyOn: boolean; initiallyAuto: boolean }) {
  const [on, setOn] = useState(initiallyOn);
  const [auto, setAuto] = useState(initiallyAuto);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setOn(next);
    setSaving(true);
    setMessage(null);
    try {
      const result = await setOpsImport(next);
      if ("error" in result) {
        setOn(!next);
        setMessage(result.error);
      }
    } catch {
      setOn(!next);
      setMessage("Non è stato possibile salvare. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="operativo" className="mb-6 scroll-mt-24 rounded-xl border border-[#e6d7bb] bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-[#233c5e]">Operativo day by day</h2>
      <p className="mb-4 text-xs text-slate-500">
        Per i tour operator e chi gestisce i servizi a destinazione: nella scheda «Operativo» compare il pulsante «Importa dai viaggi», che trasforma
        le attività degli itinerari in righe già compilate (cliente, fornitore, contatto, orario, punto di ritrovo, conferma). Le agenzie che
        scrivono le righe a mano possono lasciarlo spento.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={on} disabled={saving} onChange={(e) => toggle(e.target.checked)} />
        Importa i servizi dagli itinerari nella scheda operativa
      </label>
      <label className={`mt-3 flex items-start gap-2 text-sm font-medium ${on ? "text-slate-800" : "text-slate-400"}`}>
        <input
          type="checkbox"
          className="mt-0.5"
          checked={on && auto}
          disabled={saving || !on}
          onChange={async (e) => {
            const next = e.target.checked;
            setAuto(next);
            setSaving(true);
            setMessage(null);
            try {
              const result = await setOpsImport(next, "ops_auto");
              if ("error" in result) {
                setAuto(!next);
                setMessage(result.error);
              }
            } catch {
              setAuto(!next);
              setMessage("Non è stato possibile salvare. Riprova.");
            } finally {
              setSaving(false);
            }
          }}
        />
        <span>
          Aggiungi i servizi all&apos;Operativo quando un viaggio diventa «finale»
          <span className="block text-xs font-normal text-slate-500">
            Si presume che i servizi siano tutti confermati: entrano da soli nell&apos;Operativo, già segnati come confermati. Quelli già presenti non si
            duplicano.
          </span>
        </span>
      </label>
      {message && <p className="mt-2 text-sm text-red-700">{message}</p>}
    </section>
  );
}
