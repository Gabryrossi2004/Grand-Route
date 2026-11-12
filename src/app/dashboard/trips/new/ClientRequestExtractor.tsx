"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import DropzoneUpload from "@/components/DropzoneUpload";
import SubmitButton from "@/components/SubmitButton";
import type { ClientRequest } from "@/lib/clientRequestAi";
import { extractClientRequest } from "./actions";

// Legge la mail del cliente (testo o foto) e propone i dati del viaggio:
// non crea nulla, l'agente rivede sempre il risultato nel form prima di
// confermare la creazione del viaggio.
export default function ClientRequestExtractor({
  onExtracted,
  onCancel,
}: {
  onExtracted: (data: ClientRequest) => void;
  onCancel: () => void;
}) {
  const [state, dispatch, pending] = useActionState(
    async (_prev: { error: string | null }, formData: FormData) => {
      const result = await extractClientRequest(formData);
      if ("error" in result) return { error: result.error };
      onExtracted(result.data);
      return { error: null };
    },
    { error: null },
  );

  return (
    <form action={dispatch} className="flex flex-col gap-3">
      <div>
        <label htmlFor="text" className="mb-1 block text-sm font-medium text-slate-700">
          Testo della mail
        </label>
        <textarea
          id="text"
          name="text"
          rows={6}
          placeholder="Incolla qui il testo della mail del cliente…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
      </div>
      <DropzoneUpload
        name="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.txt,.md"
        label="Oppure carica una foto/screenshot della mail"
        autoSubmit={false}
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
        >
          Annulla
        </button>
        <SubmitButton
          pendingLabel="Leggo la richiesta…"
          className="flex items-center gap-1.5 rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
        >
          <Sparkles size={14} /> Estrai con l&apos;AI
        </SubmitButton>
      </div>
    </form>
  );
}
