"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { Profile } from "@/lib/types";
import { MAX_AGENCY_RULES_CHARS, PREFERENCE_OPTIONS, RULE_EXAMPLES, type PreferenceKey } from "@/lib/aiRules";
import { saveAiRules, testAiRules } from "./actions";
import { ASSISTANT_NAME } from "@/lib/assistant";
import AssistantIcon from "@/components/AssistantIcon";
import Zefiro from "@/components/Zefiro";

const keys = Object.keys(PREFERENCE_OPTIONS) as PreferenceKey[];

// "Regole per l'AI" dell'agenzia: scelte rapide + regole scritte a mano, e una
// prova per vedere subito l'effetto. Valgono solo per questa agenzia, in
// aggiunta alle regole di base della piattaforma.
export default function AiRulesCard({ profile }: { profile: Profile }) {
  const [prefs, setPrefs] = useState<Record<string, string>>(() =>
    Object.fromEntries(keys.map((key) => [key, profile.ai_preferences?.[key] ?? ""])),
  );
  const [text, setText] = useState(profile.ai_rules ?? "");
  const [status, setStatus] = useState<{ kind: "saved" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sample, setSample] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  function buildFormData() {
    const formData = new FormData();
    for (const key of keys) formData.set(`pref_${key}`, prefs[key] ?? "");
    formData.set("ai_rules", text);
    return formData;
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const result = await saveAiRules(buildFormData());
      if ("error" in result) setStatus({ kind: "error", message: result.error });
      else {
        setStatus({ kind: "saved", message: "Regole salvate" });
        setTimeout(() => setStatus(null), 2500);
      }
    } catch {
      setStatus({ kind: "error", message: "Salvataggio non riuscito. Controlla la connessione e riprova." });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestError(null);
    setSample(null);
    try {
      const result = await testAiRules(buildFormData());
      if ("error" in result) setTestError(result.error);
      else setSample(result.sample);
    } catch {
      setTestError("Prova non riuscita. Controlla la connessione e riprova.");
    } finally {
      setTesting(false);
    }
  }

  function addExample(example: string) {
    setText((current) => {
      if (current.includes(example)) return current;
      const next = current.trim() ? `${current.trim()}\n${example}` : example;
      return next.slice(0, MAX_AGENCY_RULES_CHARS);
    });
  }

  const selectClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";

  return (
    <section className="mb-6 rounded-xl border border-[#e6d7bb] bg-white p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-[#233c5e]">Regole per {ASSISTANT_NAME}</h2>
        <Zefiro size={72} state={testing ? "thinking" : sample ? "happy" : "idle"} className="shrink-0" />
      </div>
      <p className="mb-5 text-xs text-slate-500">
        Come deve scrivere e ragionare {ASSISTANT_NAME}. Valgono solo per la tua agenzia, in aggiunta alle regole di base di
        Grand Route.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {keys.map((key) => (
          <div key={key}>
            <label htmlFor={`pref_${key}`} className="mb-1 block text-sm font-medium text-slate-700">
              {PREFERENCE_OPTIONS[key].label}
            </label>
            <select
              id={`pref_${key}`}
              value={prefs[key] ?? ""}
              onChange={(e) => setPrefs((prev) => ({ ...prev, [key]: e.target.value }))}
              className={selectClass}
            >
              {PREFERENCE_OPTIONS[key].choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <label htmlFor="ai_rules" className="mb-1 block text-sm font-medium text-slate-700">
          Le tue regole (una per riga)
        </label>
        <textarea
          id="ai_rules"
          rows={6}
          value={text}
          maxLength={MAX_AGENCY_RULES_CHARS}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Es.\nNon usare mai la parola «imperdibile».\nAlla fine di ogni giorno ricorda il punto di incontro del giorno dopo."}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
        <p className="mt-1 text-right text-xs text-slate-500">
          {text.length}/{MAX_AGENCY_RULES_CHARS}
        </p>
        <p className="mb-1.5 text-xs font-medium text-slate-600">Esempi (clic per aggiungere)</p>
        <div className="flex flex-wrap gap-2">
          {RULE_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => addExample(example)}
              className="flex items-start gap-1 rounded-xl border border-[#e6d7bb] bg-[#faf3e6]/60 px-3 py-1.5 text-left text-xs text-[#233c5e] transition hover:bg-[#f2e2c4]"
            >
              <Plus size={12} /> {example}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
        >
          {saving ? "Salvataggio…" : "Salva le regole"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-md border border-[#cda876]/60 bg-[#faf3e6]/60 px-4 py-2 text-sm font-medium text-[#233c5e] hover:bg-[#f2e2c4] disabled:opacity-60"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <AssistantIcon size={18} />}
          {testing ? "Preparo l'esempio…" : "Prova le mie regole"}
        </button>
        {status?.kind === "saved" && <span className="text-sm font-medium text-green-700">{status.message}</span>}
        {status?.kind === "error" && (
          <span className="text-sm font-medium text-red-700" role="alert">
            {status.message}
          </span>
        )}
      </div>

      {testError && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {testError}
        </p>
      )}
      {sample && (
        <div className="mt-4 rounded-lg border border-[#e6d7bb] bg-[#faf3e6]/60 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Esempio con le tue regole</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{sample}</p>
          <p className="mt-2 text-xs text-slate-500">Ti piace? Premi &quot;Salva le regole&quot;.</p>
        </div>
      )}
    </section>
  );
}
