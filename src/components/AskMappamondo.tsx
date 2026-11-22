"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { askMappamondo } from "@/lib/actions/zefiroArchive";

const EXAMPLES = ["Quando andare a Zanzibar?", "Documenti per il Kenya", "Itinerari in Perù", "Prese elettriche in Giappone"];
const SOURCE: Record<string, string> = { paese: "dalla scheda paese", faq: "dalle tue domande frequenti", memoria: "dalle risposte salvate" };

// Domanda veloce all'archivio (schede paese, guide, domande frequenti): risposta immediata, senza AI
export default function AskMappamondo({ compact = false }: { compact?: boolean }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ answer?: string; source?: string; error?: string } | null>(null);

  async function ask(q = question) {
    if (!q.trim()) return;
    setQuestion(q);
    setBusy(true);
    setResult(await askMappamondo(q));
    setBusy(false);
  }

  return (
    <div className={`rounded-2xl border border-[#e6d7bb] bg-white ${compact ? "p-3" : "p-4"}`}>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[#233c5e]">
        <Sparkles size={15} className="text-[#c58f2d]" /> Chiedi all'Atlante
      </p>
      <p className="mb-2 text-xs text-slate-500">Risposta immediata dalle schede paese e dalle guide, gratis (senza AI).</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Es. Quando conviene andare a Phuket?"
          className="min-w-0 flex-1 rounded-lg border border-[#e6d7bb] px-3 py-1.5 text-sm outline-none focus:border-[#c58f2d]"
        />
        <button type="submit" disabled={busy} className="flex items-center gap-1 rounded-lg bg-[#233c5e] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
          <Search size={13} /> {busy ? "Cerco…" : "Chiedi"}
        </button>
      </form>
      {!result && (
        <div className="mt-2 flex flex-wrap gap-1">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => ask(ex)} className="rounded-full bg-[#f6eedc] px-2 py-0.5 text-xs text-[#5b4a2c] hover:bg-[#efe2c6]">
              {ex}
            </button>
          ))}
        </div>
      )}
      {result?.answer && (
        <div className="mt-3 rounded-xl bg-[#faf6ec] p-3">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{result.answer}</p>
          {result.source && <p className="mt-1.5 text-[11px] text-slate-400">Risposta {SOURCE[result.source] ?? ""}</p>}
        </div>
      )}
      {result?.error && <p className="mt-2 text-xs text-amber-700">{result.error}</p>}
    </div>
  );
}
