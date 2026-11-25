"use client";

import { useState, useTransition } from "react";
import BusinessFields, { type Values } from "@/components/network/BusinessFields";
import { saveNetworkProfile } from "@/lib/actions/network";
import { KIND_INFO, TRADE_KINDS, type BusinessKind } from "@/lib/network/kinds";

// Il profilo professionale: si crea (o si modifica) qui. Un cambio dei dati d'identità lo rimanda in verifica.
export default function ProfileForm({
  kind,
  kindLocked,
  values,
  listed,
}: {
  kind: BusinessKind;
  kindLocked: boolean;
  values: Values;
  listed: boolean;
}) {
  const [state, setState] = useState<Awaited<ReturnType<typeof saveNetworkProfile>>>();
  const [pending, start] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => setState(await saveNetworkProfile(undefined, fd)));
  };
  const [k, setK] = useState<BusinessKind>(kind);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 rounded-2xl border border-[#e6d7bb] bg-white p-5 sm:p-7">
      {kindLocked ? (
        <input type="hidden" name="kind" value={k} />
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tipo di attività</label>
          <select name="kind" value={k} onChange={(e) => setK(e.target.value as BusinessKind)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-80">
            {TRADE_KINDS.map((t) => (
              <option key={t} value={t}>
                {KIND_INFO[t].label}
              </option>
            ))}
          </select>
        </div>
      )}
      <BusinessFields key={k} kind={k} values={values} errors={state?.errors} />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="listed" defaultChecked={listed} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
        <span>Compari nell&apos;elenco della Rete (dopo la verifica). Togli la spunta per nasconderti senza cancellare il profilo.</span>
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Salvato.</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-full bg-[#233c5e] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60">
        {pending ? "Salvataggio…" : "Salva il profilo"}
      </button>
    </form>
  );
}
