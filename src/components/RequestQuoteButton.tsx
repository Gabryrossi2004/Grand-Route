"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { requestQuote } from "@/app/client/(portal)/actions";

export default function RequestQuoteButton({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (result) return <p className="text-xs text-emerald-700">{result}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full bg-[#233c5e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#17283f]">
        <Send size={13} /> Chiedi un preventivo
      </button>
    );
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="Quando vorresti partire, in quanti siete… (facoltativo)"
        className="w-full rounded-xl border border-[#e6d7bb] px-3 py-2 text-xs outline-none focus:border-[#c58f2d]"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await requestQuote(title, message);
            setResult(r.ok ? "Richiesta inviata: la tua agenzia ti contatterà presto." : (r.error ?? "Errore"));
          })
        }
        className="w-fit rounded-full bg-[#233c5e] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Invio…" : "Invia la richiesta"}
      </button>
    </div>
  );
}
