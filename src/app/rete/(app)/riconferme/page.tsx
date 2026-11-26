import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import ReconfirmView from "@/components/network/ReconfirmView";
import { addDays, todayRome } from "@/lib/orders/shared";
import type { AgendaRow } from "@/lib/network/agenda";

export const metadata = { title: "Riconferme" };

// Per l'agenzia: riconferma ai fornitori i servizi dei prossimi giorni (qui porta il link dell'email di promemoria)
export default async function RiconfermePage() {
  const user = await getCachedUser();
  if (!user) redirect("/login?next=/rete/riconferme");
  const today = todayRome();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_agenda", { p_from: today, p_to: addDays(today, 4) });
  const rows = ((data ?? []) as AgendaRow[]).filter((r) => r.role === "buyer" && r.status === "confermato" && r.phase !== "svolto" && r.phase !== "fatturato");
  return (
    <div>
      <p className="eyebrow">Partner</p>
      <h1 className="mt-1 text-3xl text-[#233c5e]">Riconferma i servizi</h1>
      <p className="mt-2 max-w-2xl text-base text-slate-600">
        I fornitori ti chiedono di riconfermare i servizi dei prossimi giorni. Con un tocco li avvisi che è tutto valido; se qualcosa è cambiato, scrivi al fornitore dalla conversazione dell&apos;ordine.
      </p>
      {error ? (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Serve l&apos;aggiornamento del database (migrazione 0070, in Supabase → SQL Editor).</p>
      ) : (
        <ReconfirmView rows={rows} />
      )}
    </div>
  );
}
