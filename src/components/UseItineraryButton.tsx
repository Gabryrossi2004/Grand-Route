"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { createTripFromLibraryItinerary } from "@/app/dashboard/trips/new/zefiroActions";
import type { LibraryItinerary } from "@/lib/libraryItinerary";

// Crea un viaggio nuovo con il programma giorno per giorno di questo itinerario (gratis, senza AI)
export default function UseItineraryButton({
  kind,
  code,
  label,
  itinerary,
}: {
  kind: "country" | "italy";
  code: string;
  label: string;
  itinerary: LibraryItinerary;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-2 print:hidden">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await createTripFromLibraryItinerary({ kind, key: code, label, itinerary });
            if (res?.error) setError(res.error);
          })
        }
        className="flex items-center gap-1.5 rounded-full border border-[#233c5e] px-3 py-1 text-xs font-semibold text-[#233c5e] hover:bg-[#233c5e] hover:text-white disabled:opacity-60"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <CalendarPlus size={13} />}
        {pending ? "Creo il viaggio…" : "Crea il viaggio da questo itinerario"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
