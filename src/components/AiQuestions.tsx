"use client";

import AssistantIcon from "@/components/AssistantIcon";
import { ASSISTANT_NAME } from "@/lib/assistant";

// Domande dell'AI all'agente prima di generare l'itinerario: si risponde (anche
// solo a qualcuna) e si preme di nuovo il pulsante di generazione.
export default function AiQuestions({
  questions,
  answers,
  onChange,
}: {
  questions: string[];
  answers: string[];
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[#cda876]/60 bg-[#faf3e6]/70 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#233c5e]">
        <AssistantIcon size={20} /> Prima di partire, {ASSISTANT_NAME} ha qualche dubbio
      </p>
      <p className="mb-3 text-xs text-slate-600">
        Rispondi a quelle che sai, anche in poche parole. Per le altre farà l&apos;ipotesi più ragionevole e te lo
        segnalerà nelle note.
      </p>
      <div className="flex flex-col gap-3">
        {questions.map((question, index) => (
          <div key={index}>
            <label htmlFor={`ai_answer_${index}`} className="mb-1 block text-sm font-medium text-slate-800">
              {question}
            </label>
            <textarea
              id={`ai_answer_${index}`}
              rows={2}
              value={answers[index] ?? ""}
              onChange={(e) => onChange(index, e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function formatClarifications(questions: string[], answers: string[]) {
  return questions
    .map((question, index) => `Domanda: ${question}\nRisposta: ${answers[index]?.trim() || "(nessuna risposta: usa l'ipotesi più ragionevole)"}`)
    .join("\n\n");
}
