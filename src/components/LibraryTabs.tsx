"use client";

import { useState } from "react";
import type { ActivityTemplate, PromptStyle } from "@/lib/types";
import LibraryGrid from "@/components/LibraryGrid";
import PromptStyleGrid from "@/components/PromptStyleGrid";

export default function LibraryTabs({
  templates,
  styles,
}: {
  templates: ActivityTemplate[];
  styles: PromptStyle[];
}) {
  const [tab, setTab] = useState<"blocchi" | "stili">("blocchi");

  return (
    <div>
      <div className="mb-5 flex gap-1 border-b border-[#e6d7bb]">
        <button
          type="button"
          onClick={() => setTab("blocchi")}
          className={`px-3 py-2 text-sm font-medium transition ${
            tab === "blocchi" ? "border-b-2 border-[#233c5e] text-[#233c5e]" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Blocchi
        </button>
        <button
          type="button"
          onClick={() => setTab("stili")}
          className={`px-3 py-2 text-sm font-medium transition ${
            tab === "stili" ? "border-b-2 border-[#233c5e] text-[#233c5e]" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Stili
        </button>
      </div>

      {tab === "blocchi" ? <LibraryGrid templates={templates} /> : <PromptStyleGrid styles={styles} />}
    </div>
  );
}
