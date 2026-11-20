"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteFaq, deleteMemory, saveFaq, updateMemory, type FaqRow, type MemoryRow } from "@/lib/actions/zefiroArchive";

const regionName = new Intl.DisplayNames(["it"], { type: "region" });
const input = "w-full rounded-lg border border-[#e6d7bb] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#c58f2d]";

const FAQ_EXAMPLES = [
  { question: "Quali sono gli orari dell'agenzia?", answer: "Siamo aperti dal lunedì al venerdì, 9:30–13:00 e 15:00–19:00; il sabato su appuntamento." },
  { question: "L'assicurazione è inclusa nel viaggio?", answer: "Sì, è inclusa un'assicurazione medico-bagaglio. L'annullamento è facoltativo: chiedeteci il preventivo." },
  { question: "Quanti bagagli posso portare?", answer: "Dipende dalla compagnia aerea e dalla tariffa: trovate il bagaglio incluso nei dettagli di ogni volo. Per dubbi scriveteci." },
];

export default function ZefiroArchiveEditor({ ready, faqs, memory }: { ready: boolean; faqs: FaqRow[]; memory: MemoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id?: string; question: string; answer: string } | null>(null);
  const [memEdit, setMemEdit] = useState<{ id: string; answer: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Operazione non riuscita.");
      return;
    }
    after?.();
    router.refresh();
  }

  return (
    <>
      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-[#233c5e]">Le tue domande frequenti</h2>
          {ready && !editing && (
            <button
              type="button"
              onClick={() => setEditing({ question: "", answer: "" })}
              className="flex items-center gap-1 rounded-full bg-[#233c5e] px-3 py-1.5 text-sm font-medium text-white"
            >
              <Plus size={14} /> Aggiungi
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Le risposte ufficiali dell&apos;agenzia. Zefiro le riconosce anche se il cliente scrive la domanda con parole diverse, e le
          usa come prima fonte.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {editing && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border-2 border-[#c58f2d] bg-[#fffaf0] p-4">
            <input value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} placeholder="Domanda, es. L'assicurazione è inclusa?" className={input} />
            <textarea value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} placeholder="Risposta" rows={4} className={input} />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => saveFaq(editing), () => setEditing(null))}
                className="rounded-full bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? "Salvo…" : "Salva"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="px-3 text-sm text-slate-500 hover:underline">
                Annulla
              </button>
            </div>
          </div>
        )}

        <ul className="mt-3 flex flex-col gap-2">
          {faqs.map((f) => (
            <li key={f.id} className="rounded-xl border border-[#e6d7bb] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[#1d2b40]">{f.question}</p>
                <span className="flex shrink-0 gap-1">
                  <button type="button" aria-label="Modifica" onClick={() => setEditing({ ...f })} className="rounded p-1 text-slate-400 hover:text-[#233c5e]">
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Elimina"
                    onClick={() => confirm("Eliminare questa domanda frequente?") && run(() => deleteFaq(f.id))}
                    className="rounded p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{f.answer}</p>
            </li>
          ))}
        </ul>
        {ready && faqs.length === 0 && !editing && (
          <div className="mt-3 rounded-xl border border-dashed border-[#ddc8a0] p-3">
            <p className="text-sm text-slate-600">Nessuna domanda ancora. Puoi partire da questi esempi:</p>
            <div className="mt-2 flex flex-col gap-1">
              {FAQ_EXAMPLES.map((ex) => (
                <button key={ex.question} type="button" onClick={() => setEditing({ ...ex })} className="text-left text-sm text-[#233c5e] hover:underline">
                  + {ex.question}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-8 pb-10">
        <h2 className="text-xl font-semibold text-[#233c5e]">Risposte salvate da Zefiro</h2>
        <p className="mt-1 text-sm text-slate-600">
          Quando l&apos;AI risponde a una domanda generale su un paese (non legata al singolo cliente), la risposta si salva qui e
          viene riusata gratis per domande simili. Puoi correggerla, eliminarla o trasformarla in domanda frequente.
        </p>
        {ready && memory.length === 0 && <p className="mt-3 text-sm text-slate-500">Ancora nessuna risposta salvata.</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {memory.map((m) => (
            <li key={m.id} className="rounded-xl border border-[#e6d7bb] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[#1d2b40]">{m.question}</p>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    title="Rendi domanda frequente"
                    aria-label="Rendi domanda frequente"
                    onClick={() => run(() => saveFaq({ question: m.question.slice(0, 300), answer: m.answer.slice(0, 3000) }))}
                    className="rounded p-1 text-slate-400 hover:text-[#233c5e]"
                  >
                    <BookmarkPlus size={14} />
                  </button>
                  <button type="button" aria-label="Modifica" onClick={() => setMemEdit({ id: m.id, answer: m.answer })} className="rounded p-1 text-slate-400 hover:text-[#233c5e]">
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Elimina"
                    onClick={() => confirm("Eliminare questa risposta salvata?") && run(() => deleteMemory(m.id))}
                    className="rounded p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
              {memEdit?.id === m.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea value={memEdit.answer} onChange={(e) => setMemEdit({ ...memEdit, answer: e.target.value })} rows={4} className={input} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => updateMemory(m.id, memEdit.answer), () => setMemEdit(null))}
                      className="rounded-full bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Salva
                    </button>
                    <button type="button" onClick={() => setMemEdit(null)} className="px-3 text-sm text-slate-500 hover:underline">
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{m.answer}</p>
              )}
              <p className="mt-1.5 text-[11px] text-slate-400">
                {m.countries.map((c) => regionName.of(c) ?? c).join(", ") || "Tutti i paesi"} · riusata {m.uses} {m.uses === 1 ? "volta" : "volte"}
                {m.edited ? " · corretta da te" : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
