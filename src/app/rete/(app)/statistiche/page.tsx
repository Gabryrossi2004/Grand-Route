import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import StatsView from "@/components/network/StatsView";
import { todayRome } from "@/lib/orders/shared";
import { isPeriod, periodRange, type StatsData } from "@/lib/network/stats";

export const metadata = { title: "Statistiche" };

// Statistiche del fornitore: servizi svolti, fatturato, incassi, clienti, andamento e visite alla vetrina
export default async function StatsPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await getCachedUser();
  if (!user) redirect("/professionisti?next=/rete/statistiche");
  const { periodo: p } = await searchParams;
  const periodo = isPeriod(p) ? p : "3mesi";
  const { from, to } = periodRange(periodo, todayRome());
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_stats", { p_from: from, p_to: to });
  return (
    <div>
      <p className="eyebrow">Partner</p>
      <h1 className="mt-1 text-3xl text-[#233c5e]">Statistiche</h1>
      <p className="mt-2 max-w-2xl text-base text-slate-600">Come stai lavorando: servizi svolti, fatturato, incassi, le agenzie che ti scelgono di più e quanto viene vista la tua vetrina.</p>
      <div className="mt-5">
        {error || !data ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per vedere le statistiche serve l&apos;aggiornamento del database (migrazione 0070, in Supabase → SQL Editor).</p>
        ) : (
          <StatsView data={data as StatsData} periodo={periodo} />
        )}
      </div>
    </div>
  );
}
