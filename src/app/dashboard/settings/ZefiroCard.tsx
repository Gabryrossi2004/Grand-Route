"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ZEFIRO_RESET_EVENT } from "@/components/ZefiroFloating";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { setAvatarVisible } from "./actions";

// Mostra o nasconde Zefiro che fluttua sullo schermo, e lo rimette al suo posto.
export default function ZefiroCard({ initiallyVisible }: { initiallyVisible: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(initiallyVisible);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setVisible(next);
    setSaving(true);
    setMessage(null);
    try {
      const result = await setAvatarVisible(next);
      if ("error" in result) {
        setVisible(!next);
        setMessage(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setVisible(!next);
      setMessage("Non è stato possibile salvare. Controlla la connessione e riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="zefiro" className="mb-6 scroll-mt-24 rounded-xl border border-[#e6d7bb] bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-[#233c5e]">{ASSISTANT_NAME} sullo schermo</h2>
      <p className="mb-4 text-xs text-slate-500">
        {ASSISTANT_NAME} fluttua in un angolo dello schermo: lo trascini dove ti dà meno fastidio e lo clicchi quando
        ti serve una mano (creare un viaggio, rivedere un itinerario). La posizione si ricorda su questo dispositivo.
      </p>
      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={visible}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
        />
        Mostra {ASSISTANT_NAME} sullo schermo
      </label>
      <p className="mt-1 text-xs text-slate-500">
        Se lo nascondi, trovi i pulsanti di {ASSISTANT_NAME} dentro le pagine (Nuovo viaggio e pagina del viaggio).
      </p>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(ZEFIRO_RESET_EVENT))}
        className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Rimetti {ASSISTANT_NAME} al suo posto
      </button>
      {message && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
