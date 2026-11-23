"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus, Loader2, Route } from "lucide-react";
import { createTripFromAgencyItinerary, listAgencyItineraries, type AgencyItinerary } from "@/lib/actions/agencyItineraries";

// Nella scheda paese/regione (solo per l'agenzia): gli itinerari salvati dall'agenzia in Libreria
export default function AgencyItinerariesSection({ kind, placeKey }: { kind: "country" | "italy"; placeKey: string }) {
  const [items, setItems] = useState<AgencyItinerary[] | null>(null);

  useEffect(() => {
    let alive = true;
    listAgencyItineraries({ kind, key: placeKey })
      .then((res) => alive && setItems(res.ok ? res.items : []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [kind, placeKey]);

  if (!items) return null;
  return (
    <section className="print:hidden">
      <h3 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-display)] text-xl font-semibold text-[#233c5e]">
        <Route size={18} className="text-[#c58f2d]" /> I vostri itinerari
      </h3>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/60 p-4 text-sm text-slate-500">
          Non avete ancora itinerari vostri per questa destinazione. Da un viaggio già fatto: menu «Altro» → «Salva come proposta in Libreria».
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((it) => (
            <Card key={it.id} it={it} />
          ))}
        </div>
      )}
      <Link href="/dashboard/library?tab=itinerari" className="mt-2 inline-block text-xs font-medium text-[#233c5e] underline decoration-dotted">
        Gestisci i vostri itinerari in Libreria
      </Link>
    </section>
  );
}

function Card({ it }: { it: AgencyItinerary }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <article className="rounded-2xl border-2 border-[#233c5e]/30 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-[#1d2b40]">{it.title}</h4>
        <span className="shrink-0 rounded-full bg-[#233c5e] px-2.5 py-0.5 text-xs font-bold text-white">{it.days} giorni</span>
      </div>
      {it.route && <p className="mt-1 text-sm font-medium text-[#a87a1e]">{it.route}</p>}
      {it.description && <p className="mt-1 text-sm text-slate-600">{it.description}</p>}
      <p className="mt-1 text-xs font-medium text-emerald-700">Vostro itinerario · programma giorno per giorno pronto</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await createTripFromAgencyItinerary(it.id);
            if (res?.error) setError(res.error);
          })
        }
        className="mt-2 flex items-center gap-1.5 rounded-full border border-[#233c5e] px-3 py-1 text-xs font-semibold text-[#233c5e] hover:bg-[#233c5e] hover:text-white disabled:opacity-60"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <CalendarPlus size={13} />}
        {pending ? "Creo il viaggio…" : "Crea il viaggio da questo itinerario"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </article>
  );
}
