"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { AI_PLANS, type AiPlanId } from "@/lib/aiPricing";
import {
  GATE_TOPICS_BY_PLAN,
  MAX_CLIENT_GUIDE_CHARS,
  ZEFIRO_TOPICS,
  isTopicAvailable,
  resolveTopics,
} from "@/lib/zefiroTopics";
import { saveClientZefiroConfig, setClientZefiroDefault } from "./actions";

const GUIDE_EXAMPLE = `Ristoranti che consigliamo a Marrakech:
- Al Fassia: cucina marocchina tradizionale, ottimo tajine (prenotare)
- Nomad: terrazza sulla piazza, buono per un aperitivo

Tempo libero: hammam Les Bains de Marrakech, giardino Majorelle (al mattino presto).

In caso di bisogno chiamare il nostro referente locale: +212 000 000 000.`;

// Zefiro per i clienti: interruttore generale, argomenti su cui può rispondere
// e guida scritta dall'agenzia.
export default function ClientZefiroCard({
  initiallyOn,
  preferences,
  plan,
  initialGuide,
}: {
  initiallyOn: boolean;
  preferences: Record<string, string> | null;
  plan: AiPlanId;
  initialGuide: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initiallyOn);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>(() => resolveTopics(preferences, plan));
  const [guide, setGuide] = useState(initialGuide);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saved, setSaved] = useState(false);

  async function toggle(next: boolean) {
    setOn(next);
    setSaving(true);
    setMessage(null);
    try {
      const result = await setClientZefiroDefault(next);
      if ("error" in result) {
        setOn(!next);
        setMessage(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setOn(!next);
      setMessage("Non è stato possibile salvare. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  async function saveConfig() {
    setSavingConfig(true);
    setMessage(null);
    setSaved(false);
    try {
      const result = await saveClientZefiroConfig(topics, guide);
      if ("error" in result) setMessage(result.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      }
    } catch {
      setMessage("Non è stato possibile salvare. Riprova.");
    } finally {
      setSavingConfig(false);
    }
  }

  const planName = (id: AiPlanId) => AI_PLANS.find((p) => p.id === id)?.name ?? id;

  return (
    <section className="mb-6 rounded-xl border border-[#e6d7bb] bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-[#233c5e]">{ASSISTANT_NAME} per i clienti</h2>
      <p className="mb-4 text-xs text-slate-500">
        I tuoi clienti possono fargli domande nell&apos;area clienti, anche quando sei chiuso. Scegli tu di cosa può parlare.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={on} disabled={saving} onChange={(e) => toggle(e.target.checked)} />
        {ASSISTANT_NAME} risponde ai clienti nell&apos;area clienti
      </label>

      <fieldset className={`mt-5 ${on ? "" : "opacity-50"}`} disabled={!on}>
        <legend className="mb-2 text-sm font-medium text-slate-700">Argomenti</legend>
        <div className="flex flex-col gap-2">
          {ZEFIRO_TOPICS.map((topic) => {
            const available = isTopicAvailable(topic, plan);
            const checked = topic.alwaysOn || topics.includes(topic.id);
            return (
              <label
                key={topic.id}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                  checked && available ? "border-[#cda876] bg-[#faf3e6]" : "border-slate-200"
                } ${available ? "cursor-pointer" : "opacity-60"}`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked && available}
                  disabled={topic.alwaysOn || !available}
                  onChange={(e) =>
                    setTopics((current) => (e.target.checked ? [...current, topic.id] : current.filter((t) => t !== topic.id)))
                  }
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                    {topic.label}
                    {GATE_TOPICS_BY_PLAN && topic.minPlan !== "start" && (
                      <span className="rounded-full bg-[#233c5e] px-2 py-0.5 text-[10px] font-semibold text-white">
                        {available ? `Pacchetto ${planName(topic.minPlan)}` : `Da ${planName(topic.minPlan)}`}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">{topic.description}</span>
                  <span className="block text-xs italic text-slate-400">es. «{topic.examples.join("», «")}»</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-5">
          <label htmlFor="client_guide" className="mb-1 block text-sm font-medium text-slate-700">
            La tua guida per i clienti
          </label>
          <p className="mb-1.5 text-xs text-slate-500">
            I tuoi consigli (ristoranti, cose da fare, contatti utili) hanno la precedenza su qualsiasi altra fonte: così {ASSISTANT_NAME}{" "}
            consiglia ciò che consigli tu, senza inventare. Scrivi pure per località.
          </p>
          <textarea
            id="client_guide"
            rows={8}
            value={guide}
            maxLength={MAX_CLIENT_GUIDE_CHARS}
            onChange={(e) => setGuide(e.target.value)}
            placeholder={GUIDE_EXAMPLE}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
          <p className="mt-1 text-right text-xs text-slate-500">
            {guide.length}/{MAX_CLIENT_GUIDE_CHARS}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveConfig}
            disabled={savingConfig}
            className="rounded-md bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
          >
            {savingConfig ? "Salvataggio…" : "Salva argomenti e guida"}
          </button>
          {saved && <span className="text-sm font-medium text-green-700">Salvato</span>}
        </div>
      </fieldset>

      <ul className="mt-4 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
        <li>Ogni risposta usa il tuo budget giornaliero; i clienti ne possono usare al massimo il 70%.</li>
        <li>Ogni cliente può fare al massimo 8 domande all&apos;ora e 25 al giorno.</li>
        <li>Documenti e visti, salute, norme e sicurezza restano sempre all&apos;agenzia: Zefiro rimanda alla chat.</li>
        <li>Per un singolo viaggio puoi cambiare la scelta, nella scheda «Chat con il cliente».</li>
      </ul>
      {message && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
