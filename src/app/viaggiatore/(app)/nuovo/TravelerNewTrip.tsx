"use client";

import { useActionState } from "react";
import { BookOpen, Pencil, Sparkles } from "lucide-react";
import GenerateWithZefiro from "@/app/dashboard/trips/new/GenerateWithZefiro";
import { triggerZefiroAction } from "@/components/ZefiroFloating";
import DateField from "@/components/DateField";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { createTravelerTrip } from "../../actions";
import { useState } from "react";

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";

// Tre modi per cominciare: proposte pronte (gratis), Zefiro con l'AI (limitato) o un viaggio vuoto
export default function TravelerNewTrip({ left, total }: { left: number; total: number }) {
  const [state, formAction, pending] = useActionState(createTravelerTrip, undefined);
  const [start, setStart] = useState("");
  const noAi = left <= 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Nuovo viaggio</h1>
        <p className="mt-1 text-sm text-slate-600">Come vuoi cominciare?</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => triggerZefiroAction("new-trip-proposals")}
          className="flex flex-col gap-2 rounded-2xl border-2 border-emerald-600 bg-white p-5 text-left transition hover:bg-emerald-50"
        >
          <span className="flex items-center gap-2 text-lg font-semibold text-emerald-800">
            <BookOpen size={20} /> Proposte pronte
          </span>
          <span className="text-sm text-slate-600">Itinerari già scritti giorno per giorno per ogni paese e regione italiana. Scegli, poi cambi quello che vuoi.</span>
          <span className="mt-auto w-fit rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">Gratis</span>
        </button>
        <button
          type="button"
          disabled={noAi}
          onClick={() => triggerZefiroAction("new-trip")}
          className="flex flex-col gap-2 rounded-2xl border-2 border-[#233c5e] bg-white p-5 text-left transition hover:bg-[#eef2f8] disabled:opacity-60"
        >
          <span className="flex items-center gap-2 text-lg font-semibold text-[#233c5e]">
            <Sparkles size={20} /> Racconta a {ASSISTANT_NAME}
          </span>
          <span className="text-sm text-slate-600">Rispondi a poche domande e {ASSISTANT_NAME} scrive l&apos;itinerario su misura per te.</span>
          <span className="mt-auto w-fit rounded-full bg-[#233c5e] px-2.5 py-0.5 text-[11px] font-semibold text-white">
            {noAi ? "Finiti per questo mese" : `Creato con AI · ${left} su ${total} questo mese`}
          </span>
        </button>
      </div>

      <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-[#233c5e]">
          <Pencil size={18} /> Oppure parti da un viaggio vuoto
        </h2>
        <p className="mb-3 text-sm text-slate-600">Scrivi tu giorni e attività. Le date si possono mettere anche dopo.</p>
        <form action={formAction} className="grid gap-3 sm:grid-cols-2">
          <input name="title" required minLength={2} maxLength={160} placeholder="Titolo (es. Estate in Portogallo)" className={field} />
          <input name="destination" maxLength={120} placeholder="Destinazione (facoltativa)" className={field} />
          <input name="days" type="number" min={1} max={30} defaultValue={5} aria-label="Quanti giorni" className={field} />
          <div>
            <DateField id="start_date" name="start_date" value={start} onChange={setStart} className={field} />
          </div>
          {state?.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
          <button type="submit" disabled={pending} className="rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60 sm:col-span-2 sm:w-fit">
            {pending ? "Creo il viaggio…" : "Crea il viaggio vuoto"}
          </button>
        </form>
      </section>

      <GenerateWithZefiro clients={[]} promptStyles={[]} showButton={false} traveler={{ left, total }} />
    </div>
  );
}
