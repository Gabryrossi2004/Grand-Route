"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { clearAiNotes } from "@/app/dashboard/trips/[id]/actions";
import { ASSISTANT_NAME } from "@/lib/assistant";
import AssistantIcon from "@/components/AssistantIcon";

// Note lasciate dall'AI dopo la generazione dell'itinerario (ipotesi fatte,
// dubbi, tragitti da verificare). Si leggono e poi si nascondono.
export default function AiNotes({ tripId, notes }: { tripId: string; notes: string }) {
  const [hidden, setHidden] = useState(false);
  const router = useRouter();
  if (hidden) return null;

  const lines = notes
    .split("\n")
    .map((line) => line.replace(/^•\s*/, "").trim())
    .filter(Boolean);

  async function dismiss() {
    setHidden(true);
    await clearAiNotes(tripId);
    router.refresh();
  }

  return (
    <div className="mx-5 mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AssistantIcon size={20} /> Note di {ASSISTANT_NAME} da verificare
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Nascondi le note"
          title="Ho letto, nascondi"
          className="rounded p-1 text-amber-800 transition hover:bg-amber-100"
        >
          <X size={15} />
        </button>
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-800">
        Le stime su distanze e tempi sono approssimative: controllale prima di confermare il viaggio al cliente.
      </p>
    </div>
  );
}
