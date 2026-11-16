"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Sparkles, Trash2 } from "lucide-react";
import type { PromptStyle } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";
import { addPromptStyle, deletePromptStyle, updatePromptStyle } from "@/app/dashboard/library/actions";

function StyleForm({ style, onDone }: { style?: PromptStyle; onDone: () => void }) {
  const isEdit = Boolean(style);
  const action = isEdit ? updatePromptStyle.bind(null, style!.id) : addPromptStyle;
  const router = useRouter();

  const [, dispatch, pending] = useActionState(async (_prev: null, formData: FormData) => {
    await action(formData);
    router.refresh();
    onDone();
    return null;
  }, null);

  return (
    <form action={dispatch} className="flex flex-col gap-3">
      <div>
        <label htmlFor="style_title" className="mb-1 block text-sm font-medium text-slate-700">
          Nome dello stile *
        </label>
        <input
          id="style_title"
          name="title"
          required
          defaultValue={style?.title ?? ""}
          placeholder="Es. Famiglia con bambini"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>
      <div>
        <label htmlFor="style_prompt_text" className="mb-1 block text-sm font-medium text-slate-700">
          Istruzioni di tono *
        </label>
        <textarea
          id="style_prompt_text"
          name="prompt_text"
          required
          rows={4}
          defaultValue={style?.prompt_text ?? ""}
          placeholder="Descrivi il tono/taglio che deve usare l'assistente per questo tipo di viaggio o cliente…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
        <p className="mt-1 text-xs text-slate-500">
          Riguarda solo lo stile della scrittura: l&apos;assistente continua a non inventare mai dati non presenti nella
          bozza.
        </p>
      </div>
      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
        >
          Annulla
        </button>
        <SubmitButton
          pendingLabel={isEdit ? "Salvataggio…" : "Creazione…"}
          className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
        >
          {isEdit ? "Salva modifiche" : "Aggiungi stile"}
        </SubmitButton>
      </div>
    </form>
  );
}

export default function PromptStyleGrid({ styles }: { styles: PromptStyle[] }) {
  const [formTarget, setFormTarget] = useState<"new" | PromptStyle | null>(null);

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Scegli uno di questi stili (o aggiungine uno tuo) quando chiedi un itinerario all&apos;assistente, per guidare il
        tono delle descrizioni verso il tipo di viaggio o di cliente giusto.
      </p>

      {styles.length === 0 && formTarget !== "new" && (
        <p className="mb-4 text-sm text-slate-500">Nessuno stile ancora.</p>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {styles.map((style) => {
          const isEditingThis = formTarget !== "new" && formTarget?.id === style.id;
          if (isEditingThis) {
            return (
              <div key={style.id} className="rounded-xl border border-[#cda876]/40 bg-[#faf3e6]/60 p-4 sm:col-span-2 lg:col-span-3">
                <StyleForm style={style} onDone={() => setFormTarget(null)} />
              </div>
            );
          }
          return (
            <div key={style.id} className="rounded-xl border-l-4 border-y border-r border-[#cda876] bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#cda876] text-white">
                    <Sparkles size={14} />
                  </span>
                  <p className="font-medium text-slate-900">{style.title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFormTarget(style)}
                    title="Modifica stile"
                    className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil size={13} />
                  </button>
                  <form action={deletePromptStyle.bind(null, style.id)}>
                    <SubmitButton
                      pendingLabel="…"
                      className="rounded-md p-1.5 text-red-500 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 size={13} />
                    </SubmitButton>
                  </form>
                </div>
              </div>
              <p className="line-clamp-3 text-xs text-slate-500">{style.prompt_text}</p>
            </div>
          );
        })}
      </div>

      {formTarget === "new" ? (
        <div className="rounded-xl border border-[#cda876]/40 bg-[#faf3e6]/60 p-4">
          <StyleForm onDone={() => setFormTarget(null)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setFormTarget("new")}
          className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + Nuovo stile
        </button>
      )}
    </div>
  );
}
