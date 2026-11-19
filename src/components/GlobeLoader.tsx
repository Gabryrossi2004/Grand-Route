"use client";

import dynamic from "next/dynamic";
import type { GlobeTrip } from "@/components/TravelGlobe";

// Il globo (three.js + confini dei paesi) si scarica solo su questa pagina, non nel resto del sito
const TravelGlobe = dynamic(() => import("@/components/TravelGlobe"), {
  ssr: false,
  loading: () => <div className="grid aspect-square w-full place-items-center rounded-3xl bg-[#13233c] text-sm text-white/80">Carico il mondo…</div>,
});

export default function GlobeLoader({ trips, userId, photoCounts }: { trips: GlobeTrip[]; userId: string; photoCounts: Record<string, number> }) {
  return <TravelGlobe trips={trips} userId={userId} photoCounts={photoCounts} />;
}
