"use client";

import { useState } from "react";
import ActionForm from "@/components/ActionForm";
import { addRule, resetRule, saveRule } from "./actions";

export type EditableRule = {
  key: string;
  title: string;
  body: string;
  enabled: boolean;
  sort_order: number;
  isDefault: boolean; // esiste nel codice come regola predefinita
  customized: boolean; // salvata (modificata) nel database
};

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]";

export default function RuleEditor({ rules }: { rules: EditableRule[] }) {
  const [resetting, setResetting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  async function reset(key: string) {
    setResetting(key);
    setMessage(null);
    const result = await resetRule(key);
    if ("error" in result) setMessage(result.error);
    else setVersion((v) => v + 1);
    setResetting(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {rules.map((rule) => (
        <ActionForm
          key={`${rule.key}-${version}`}
          action={saveRule.bind(null, rule.key, rule.sort_order)}
          className="rounded-xl border border-[#e6d7bb] bg-white p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {rule.isDefault ? (rule.customized ? "Regola di base (modificata)" : "Regola di base (predefinita)") : "Regola aggiunta da te"}
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="enabled" defaultChecked={rule.enabled} />
              Attiva
            </label>
          </div>
          <label htmlFor={`title_${rule.key}`} className="mb-1 block text-sm font-medium text-slate-700">
            Titolo
          </label>
          <input id={`title_${rule.key}`} name="title" defaultValue={rule.title} className={`${inputClass} mb-3`} />
          <label htmlFor={`body_${rule.key}`} className="mb-1 block text-sm font-medium text-slate-700">
            Testo (quello che l&apos;AI legge)
          </label>
          <textarea id={`body_${rule.key}`} name="body" rows={5} defaultValue={rule.body} className={inputClass} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f]"
            >
              Salva
            </button>
            {rule.customized && (
              <button
                type="button"
                onClick={() => reset(rule.key)}
                disabled={resetting === rule.key}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {rule.isDefault ? "Ripristina il testo predefinito" : "Elimina la regola"}
              </button>
            )}
          </div>
        </ActionForm>
      ))}

      {message && (
        <p className="text-sm text-red-700" role="alert">
          {message}
        </p>
      )}

      <ActionForm action={addRule} className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
        <p className="mb-3 text-sm font-medium text-slate-800">Aggiungi una nuova regola di base</p>
        <input name="title" placeholder="Titolo (es. Meteo)" className={`${inputClass} mb-3`} />
        <textarea
          name="body"
          rows={3}
          placeholder="Testo della regola, scritto come lo scriveresti a un collaboratore."
          className={inputClass}
        />
        <button
          type="submit"
          className="mt-3 rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Aggiungi
        </button>
      </ActionForm>
    </div>
  );
}
