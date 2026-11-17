"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiUsageSummary } from "@/lib/aiQuota";
import { AI_PLANS, SHOW_PLAN_PRICES, formatEuro, type AiPlanId } from "@/lib/aiPricing";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { setAiPlan } from "./actions";

const FEATURE_LABELS: Record<string, string> = {
  itinerary: "Generazione itinerari",
  review: "Suggerimenti sul viaggio",
  client_request: "Lettura richieste clienti",
  price_list: "Lettura listini",
  rules_test: "Prova delle regole",
  "client:zefiro": "Zefiro per i clienti",
};

// Quanto ha usato Zefiro oggi e nel mese (con il costo reale in euro) e il
// pacchetto giornaliero scelto. Il budget si azzera a mezzanotte.
export default function ZefiroUsageCard({ summary }: { summary: AiUsageSummary }) {
  const router = useRouter();
  const [plan, setPlan] = useState<AiPlanId>(summary.plan as AiPlanId);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const budget = AI_PLANS.find((p) => p.id === plan)?.dailyBudgetEur ?? summary.dailyBudgetEur;
  const percent = Math.min(100, Math.round((summary.spentTodayEur / budget) * 100));
  const remaining = Math.max(0, budget - summary.spentTodayEur);
  const barColor = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-[#cda876]";
  const avg = summary.callsMonth > 0 ? summary.spentMonthEur / summary.callsMonth : 0;

  async function choose(next: AiPlanId) {
    if (next === plan || busy) return;
    const previous = plan;
    setPlan(next);
    setBusy(true);
    setMessage(null);
    try {
      const result = await setAiPlan(next);
      if ("error" in result) {
        setPlan(previous);
        setMessage(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setPlan(previous);
      setMessage("Non è stato possibile salvare. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-[#e6d7bb] bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-[#233c5e]">Consumi di {ASSISTANT_NAME}</h2>
      <p className="mb-4 text-xs text-slate-500">
        Costo reale delle richieste fatte a {ASSISTANT_NAME}. Il budget giornaliero si rinnova a mezzanotte.
      </p>

      {!summary.available && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Il contatore parte dopo un aggiornamento del database (migrazione 0035).
        </p>
      )}

      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">Oggi</p>
        <p className="text-sm text-slate-700">
          <span className="text-xl font-semibold text-[#233c5e]">{formatEuro(summary.spentTodayEur)}</span> su{" "}
          {formatEuro(budget)}
        </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#f1e6cf]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Ti restano {formatEuro(remaining)} · {summary.callsToday} richieste oggi
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-[#faf3e6]/70 p-3">
          <dt className="text-xs text-slate-500">Questo mese</dt>
          <dd className="font-semibold text-[#233c5e]">{formatEuro(summary.spentMonthEur)}</dd>
        </div>
        <div className="rounded-lg bg-[#faf3e6]/70 p-3">
          <dt className="text-xs text-slate-500">Costo medio per richiesta</dt>
          <dd className="font-semibold text-[#233c5e]">{summary.callsMonth ? formatEuro(avg) : "–"}</dd>
        </div>
      </dl>

      {summary.byFeature.length > 0 && (
        <ul className="mt-4 divide-y divide-[#f1e6cf] text-sm">
          {summary.byFeature.map((row) => (
            <li key={row.kind} className="flex items-center justify-between py-1.5">
              <span className="text-slate-700">{FEATURE_LABELS[row.kind] ?? row.kind}</span>
              <span className="text-slate-500">
                {row.calls} · {formatEuro(row.costEur)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <fieldset className="mt-5" disabled={busy}>
        <legend className="mb-2 text-sm font-medium text-slate-700">Pacchetto giornaliero</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {AI_PLANS.map((option) => (
            <label
              key={option.id}
              className={`cursor-pointer rounded-xl border p-3 transition ${
                plan === option.id ? "border-[#cda876] bg-[#faf3e6]" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="ai_plan"
                value={option.id}
                checked={plan === option.id}
                onChange={() => choose(option.id)}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-[#233c5e]">{option.name}</span>
              <span className="block text-lg font-semibold text-slate-800">{formatEuro(option.dailyBudgetEur)} <span className="text-xs font-normal text-slate-500">al giorno</span></span>
              <span className="mt-1 block text-xs text-slate-500">{option.blurb}</span>
              {SHOW_PLAN_PRICES && (
                <span className="mt-1 block text-xs font-medium text-slate-700">{option.monthlyPriceEur} €/mese + IVA</span>
              )}
            </label>
          ))}
        </div>
        {message && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {message}
          </p>
        )}
      </fieldset>
    </section>
  );
}
