"use client";

import { useActionState } from "react";

const input = "w-full rounded-xl border border-[#e6d7bb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#c58f2d]";

export default function ReferralForm({
  action,
  agency,
}: {
  action: (prev: { ok?: boolean; error?: string } | undefined, formData: FormData) => Promise<{ ok?: boolean; error?: string }>;
  agency: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  if (state?.ok) {
    return <p className="rounded-2xl bg-emerald-50 p-5 text-center text-sm text-emerald-800">Grazie! {agency} ti contatterà presto per il tuo prossimo viaggio.</p>;
  }
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input name="name" required maxLength={120} placeholder="Il tuo nome e cognome" className={input} />
      <input name="contact" required maxLength={160} placeholder="Email o numero di telefono" className={input} />
      <textarea name="message" rows={3} maxLength={1000} placeholder="Dove ti piacerebbe andare? (facoltativo)" className={input} />
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4" />
        <span>
          Acconsento a essere contattato da {agency} per ricevere una proposta di viaggio. I miei dati vanno solo all&apos;agenzia (
          <a href="/privacy" className="underline">privacy</a>).
        </span>
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-xl bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60">
        {pending ? "Invio…" : "Voglio essere contattato"}
      </button>
    </form>
  );
}
