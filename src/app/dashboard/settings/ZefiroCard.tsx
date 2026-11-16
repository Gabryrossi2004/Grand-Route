"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Zefiro from "@/components/Zefiro";
import { ZEFIRO_RESET_EVENT } from "@/components/ZefiroFloating";
import { ASSISTANT_NAME, ZEFIRO_VARIANTS, type ZefiroMode, type ZefiroVariantId } from "@/lib/assistant";
import { setAvatarStyle, setAvatarVisible } from "./actions";

// Mostra o nasconde Zefiro che fluttua sullo schermo, e lo rimette al suo posto.
export default function ZefiroCard({
  initiallyVisible,
  initialStyle,
}: {
  initiallyVisible: boolean;
  initialStyle: ZefiroMode;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(initiallyVisible);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [style, setStyle] = useState<ZefiroMode>(initialStyle);
  // In modalità "dinamico" l'anteprima mostra tutti i costumi a rotazione
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (style !== "dinamico") return;
    const timer = setInterval(() => setCycle((n) => (n + 1) % ZEFIRO_VARIANTS.length), 2600);
    return () => clearInterval(timer);
  }, [style]);
  const previewVariant: ZefiroVariantId = style === "dinamico" ? ZEFIRO_VARIANTS[cycle].id : style;
  const [mood, setMood] = useState<"idle" | "happy">("idle");

  async function chooseStyle(next: ZefiroMode) {
    if (next === style) return;
    const previous = style;
    setStyle(next);
    setMood("happy");
    setTimeout(() => setMood("idle"), 1600);
    setMessage(null);
    try {
      const result = await setAvatarStyle(next);
      if ("error" in result) {
        setStyle(previous);
        setMessage(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setStyle(previous);
      setMessage("Non è stato possibile salvare. Controlla la connessione e riprova.");
    }
  }

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
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0 self-center rounded-2xl bg-[#faf3e6]/80 p-2">
          <Zefiro size={170} state={mood} variant={previewVariant} />
        </div>
        <fieldset className="min-w-0 flex-1">
          <legend className="mb-2 text-sm font-medium text-slate-700">Il costume di {ASSISTANT_NAME}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                id: "dinamico" as ZefiroMode,
                name: "Dinamico",
                description: `${ASSISTANT_NAME} si veste secondo la meta del viaggio che stai guardando`,
              },
              ...ZEFIRO_VARIANTS,
            ].map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 transition ${
                  option.id === "dinamico" ? "sm:col-span-2" : ""
                } ${style === option.id ? "border-[#cda876] bg-[#faf3e6]" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <input
                  type="radio"
                  name="zefiro_style"
                  value={option.id}
                  checked={style === option.id}
                  onChange={() => chooseStyle(option.id)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{option.name}</span>
                  <span className="block text-xs text-slate-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

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
