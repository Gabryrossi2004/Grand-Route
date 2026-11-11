"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import Modal from "@/components/Modal";
import SubmitButton from "@/components/SubmitButton";
import { applyAiItineraryDraft } from "@/app/dashboard/trips/[id]/actions";

export default function AiItineraryGenerator({ tripId }: { tripId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const action = applyAiItineraryDraft.bind(null, tripId);

  const [state, dispatch, pending] = useActionState(async (_prev: { error: string | null } | null, formData: FormData) => {
    const result = await action(formData);
    if (!result.error) {
      router.refresh();
      setIsOpen(false);
    }
    return result;
  }, null);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-[#cda876]/60 bg-[#faf3e6]/60 px-4 py-2 text-sm font-semibold text-[#233c5e] transition hover:bg-[#f2e2c4]"
      >
        <Sparkles size={15} />
        Genera itinerario con l&apos;AI
      </button>

      {isOpen && (
        <Modal title="Genera itinerario da una bozza" onClose={() => setIsOpen(false)}>
          <p className="mb-3 -mt-2 text-sm text-slate-500">
            Incolla qui la bozza dell&apos;itinerario, anche scritta in modo informale: l&apos;AI la trasformerà in
            giorni e attività, da rivedere con calma prima di passare l&apos;itinerario a &quot;finale&quot;. Non
            inventa orari, numeri o altri dati che non sono già nella bozza.
          </p>
          <form action={dispatch} className="flex flex-col gap-3">
            <textarea
              name="draft_text"
              rows={10}
              required
              placeholder={
                "Es.\nGiorno 1: arrivo a Roma, check-in Hotel Roma Centro (via...). Cena libera.\nGiorno 2: ore 9:30 visita guidata al Colosseo, punto di incontro davanti all'ingresso. Pranzo libero. Pomeriggio al Foro Romano."
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
            />
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
              >
                Annulla
              </button>
              <SubmitButton
                pendingLabel="Generazione in corso…"
                className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f] disabled:opacity-60"
              >
                Genera
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
