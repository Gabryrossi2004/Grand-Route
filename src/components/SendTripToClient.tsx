"use client";

import { useState, useTransition } from "react";
import { Check, Mail, Send, X } from "lucide-react";
import { sendTripToClient } from "@/lib/actions/sendTrip";

type Props = {
  tripId: string;
  clientName: string | null;
  clientEmail: string | null;
  notifiedAt: string | null;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

// Pulsante "Invia al cliente" con conferma: la mail parte solo dopo aver
// premuto "Sì, invia" (così non si invia per sbaglio un viaggio ancora in modifica).
export default function SendTripToClient({ tripId, clientName, clientEmail, notifiedAt }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<string | null>(notifiedAt);

  const base = "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition";

  if (!clientEmail) {
    return (
      <span
        title="Collega un cliente a questo viaggio e aggiungi la sua email nella scheda cliente"
        className={`${base} cursor-not-allowed border border-slate-200 text-slate-400`}
      >
        <Mail size={15} /> Invia al cliente
      </span>
    );
  }

  function confirmSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendTripToClient(tripId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSentAt(result.at);
      setOpen(false);
    });
  }

  return (
    <div className={open ? "w-full" : "flex flex-wrap items-center gap-2"}>
      {!open && (
        <>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            className={`${base} border border-[#233c5e] text-[#233c5e] hover:bg-[#233c5e] hover:text-white`}
          >
            <Mail size={15} />
            {sentAt ? "Invia di nuovo" : "Invia al cliente"}
          </button>
          {sentAt && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700">
              <Check size={13} /> Inviato il {when(sentAt)}
            </span>
          )}
        </>
      )}

      {open && (
        <div role="alertdialog" aria-label="Conferma invio al cliente" className="rounded-xl border border-[#cda876] bg-[#faf3e6] p-4">
          <p className="text-sm text-slate-800">
            Invio il viaggio a <strong>{clientName || "questo cliente"}</strong> ({clientEmail})?
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Gli arriva una mail con il link al viaggio pubblicato. Se ha già un account, lo trova anche nell&apos;area clienti.
            {sentAt && " Questo viaggio gli è già stato inviato."}
          </p>
          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmSend}
              disabled={pending}
              className={`${base} bg-[#233c5e] text-white hover:bg-[#17283f] disabled:opacity-60`}
            >
              <Send size={15} /> {pending ? "Invio in corso…" : "Sì, invia"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className={`${base} border border-slate-300 text-slate-700 hover:bg-white`}
            >
              <X size={15} /> Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
