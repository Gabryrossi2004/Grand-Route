import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import AgendaView from "@/components/network/AgendaView";
import { todayRome } from "@/lib/orders/shared";
import { agendaRange, isIsoDate, type AgendaRow } from "@/lib/network/agenda";

export const metadata = { title: "Agenda" };

// Agenda dei servizi: qui si caricano i dati, la pagina è in AgendaView
export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ vista?: string; data?: string }> }) {
  const user = await getCachedUser();
  if (!user) redirect("/login?next=/rete/agenda");
  const { vista: v, data } = await searchParams;
  const vista = v === "mese" ? "mese" : "settimana";
  const today = todayRome();
  const ref = isIsoDate(data) ? data : today;
  const { from, to } = agendaRange(vista, ref);
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("network_agenda", { p_from: from, p_to: to });
  return <AgendaView me={user.id} today={today} vista={vista} refDate={ref} rows={(rows ?? []) as AgendaRow[]} error={!!error} />;
}
