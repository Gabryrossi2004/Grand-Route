"use client";

import { useState } from "react";
import type { ActivityTemplate, PromptStyle } from "@/lib/types";
import type { AgencyItinerary } from "@/lib/actions/agencyItineraries";
import LibraryGrid from "@/components/LibraryGrid";
import PromptStyleGrid from "@/components/PromptStyleGrid";
import AgencyItineraryList from "@/components/AgencyItineraryList";

type Tab = "blocchi" | "itinerari" | "stili";

export default function LibraryTabs({
  templates,
  styles,
  itineraries,
  itinerariesNotReady,
  trips,
  initialTab = "blocchi",
}: {
  templates: ActivityTemplate[];
  styles: PromptStyle[];
  itineraries: AgencyItinerary[];
  itinerariesNotReady: string | null;
  trips: { id: string; title: string; destination: string | null }[];
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const tabs: { id: Tab; label: string }[] = [
    { id: "blocchi", label: "Blocchi" },
    { id: "itinerari", label: `Itinerari${itineraries.length ? ` (${itineraries.length})` : ""}` },
    { id: "stili", label: "Stili" },
  ];

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-[#e6d7bb]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? "border-b-2 border-[#233c5e] text-[#233c5e]" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "blocchi" && <LibraryGrid templates={templates} />}
      {tab === "itinerari" && <AgencyItineraryList items={itineraries} notReady={itinerariesNotReady} trips={trips} />}
      {tab === "stili" && <PromptStyleGrid styles={styles} />}
    </div>
  );
}
