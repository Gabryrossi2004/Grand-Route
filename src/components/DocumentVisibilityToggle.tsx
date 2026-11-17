"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { setDocumentVisibility } from "@/app/dashboard/trips/[id]/actions";

// Interruttore "visibile al cliente" per un documento di viaggio.
export default function DocumentVisibilityToggle({
  tripId,
  documentId,
  initial,
}: {
  tripId: string;
  documentId: string;
  initial: boolean;
}) {
  const [visible, setVisible] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !visible;
    setVisible(next);
    setError(null);
    startTransition(async () => {
      const result = await setDocumentVisibility(tripId, documentId, next);
      if ("error" in result) {
        setVisible(!next);
        setError(result.error ?? "Errore");
      }
    });
  }

  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={visible}
        title={visible ? "Il cliente vede questo documento: tocca per nasconderlo" : "Tocca per mostrarlo al cliente"}
        className={`flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
          visible ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
        }`}
      >
        {visible ? <Eye size={13} /> : <EyeOff size={13} />}
        {visible ? "Visibile al cliente" : "Solo tu"}
      </button>
      {error && (
        <span className="mt-1 max-w-48 text-right text-[11px] text-red-700" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
