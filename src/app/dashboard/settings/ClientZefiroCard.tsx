"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { setClientZefiroDefault } from "./actions";

// Interruttore generale: Zefiro risponde ai clienti nell'area clienti.
export default function ClientZefiroCard({ initiallyOn }: { initiallyOn: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initiallyOn);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setOn(next);
    setSaving(true);
    setMessage(null);
    try {
      const result = await setClientZefiroDefault(next);
      if ("error" in result) {
        setOn(!next);
        setMessage(result.error);
      } else {
        router.refresh();
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
      <h2 className="mb-1 text-lg font-medium text-[#233c5e]">{ASSISTANT_NAME} per i clienti</h2>
      <p className="mb-4 text-xs text-slate-500">
        I tuoi clienti possono fargli domande sul loro viaggio (programma, orari, pagamenti), anche quando sei chiuso.
        Risponde solo con i dati che il cliente vede già.
      </p>
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input type="checkbox" checked={on} disabled={saving} onChange={(e) => toggle(e.target.checked)} />
        {ASSISTANT_NAME} risponde ai clienti nell&apos;area clienti
      </label>
      <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
        <li>Ogni risposta usa il tuo budget giornaliero; i clienti ne possono usare al massimo il 70%.</li>
        <li>Ogni cliente può fare al massimo 8 domande all&apos;ora e 25 al giorno.</li>
        <li>Per un singolo viaggio puoi cambiare la scelta, nella scheda «Chat con il cliente».</li>
      </ul>
      {message && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
