"use client";

import { useState } from "react";
import { setAutoMessages } from "./actions";

// Messaggi automatici ai clienti sulle notifiche del telefono
export default function AutoMessagesCard({ initiallyOn }: { initiallyOn: boolean }) {
  const [on, setOn] = useState(initiallyOn);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setOn(next);
    setSaving(true);
    setMessage(null);
    try {
      const result = await setAutoMessages(next);
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
    <section className="mb-6 rounded-xl border border-[#e6d7bb] bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-[#233c5e]">Messaggi automatici ai clienti</h2>
      <p className="mb-4 text-xs text-slate-500">
        Grand Route manda da solo una notifica sul telefono dei clienti che hanno attivato le notifiche: la vigilia della partenza
        («Domani si parte!»), il primo giorno («Buon viaggio!») e il giorno dopo il rientro («Bentornato!», con l&apos;invito a
        raccontare com&apos;è andata). I messaggi sono firmati con il nome dell&apos;agenzia e non usano l&apos;AI.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={on} disabled={saving} onChange={(e) => toggle(e.target.checked)} />
        Invia i messaggi automatici ai clienti
      </label>
      {message && <p className="mt-2 text-sm text-red-700">{message}</p>}
    </section>
  );
}
