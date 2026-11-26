"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendConfirmationReminder } from "@/lib/actions/rotta";

// «Sollecita il cliente»: una mail con il pulsante per confermare, una volta sola per viaggio
export default function ReminderButton({ tripId, sentAt }: { tripId: string; sentAt: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(sentAt ? { ok: true, text: "Promemoria già inviato" } : null);

  if (msg?.ok) return <span className="text-xs font-medium text-emerald-700">{msg.text}</span>;
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendConfirmationReminder(tripId);
            setMsg("ok" in r ? { ok: true, text: `Inviato a ${r.email}` } : { ok: false, text: r.error });
          })
        }
        className="inline-flex items-center gap-1.5 rounded-full border border-[#233c5e] px-3 py-1.5 text-xs font-semibold text-[#233c5e] transition hover:bg-[#233c5e] hover:text-white disabled:opacity-60"
      >
        <Send size={13} aria-hidden /> {pending ? "Invio…" : "Sollecita il cliente"}
      </button>
      {msg && !msg.ok && <span className="max-w-60 text-right text-xs text-red-700">{msg.text}</span>}
    </div>
  );
}
