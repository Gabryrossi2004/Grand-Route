"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { setServiceReminders } from "@/lib/actions/agenda";

// Interruttore del promemoria automatico della sera prima (di base acceso)
export default function ReminderPanel({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !on;
    setOn(next);
    setError(null);
    start(async () => {
      const r = await setServiceReminders(next);
      if (!r.ok) {
        setOn(!next);
        setError(r.error);
      }
    });
  };

  return (
    <section className="mt-4 rounded-2xl border border-[#e6d7bb] bg-white p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? "bg-[#233c5e] text-white" : "bg-slate-100 text-slate-500"}`}>
          {on ? <Bell size={18} /> : <BellOff size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#233c5e]">Promemoria della sera prima</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {on
              ? "Ogni giorno dopo le 16:00 controlliamo i servizi di domani (il venerdì fino a lunedì). Se un'agenzia non li ha ancora riconfermati, le mandiamo un'email a tuo nome con tutti i suoi servizi. Se ha già riconfermato o ti ha scritto oggi, non le arriva niente."
              : "Spento: non mandiamo nessuna email di riconferma alle agenzie. Puoi riaccenderlo quando vuoi."}
          </p>
          {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Promemoria della sera prima"
          disabled={pending}
          onClick={toggle}
          data-nofx
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-600" : "bg-slate-300"} disabled:opacity-60`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.375rem]" : "left-0.5"}`} />
        </button>
      </div>
    </section>
  );
}
