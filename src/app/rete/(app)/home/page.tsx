import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import SupplierHomeView from "@/components/network/SupplierHomeView";
import { addDays, todayRome } from "@/lib/orders/shared";
import type { AgendaRow } from "@/lib/network/agenda";

export const metadata = { title: "Home" };

// Home del fornitore: qui si caricano i dati, la pagina è in SupplierHomeView
export default async function SupplierHome() {
  const user = await getCachedUser();
  if (!user) redirect("/login?next=/rete/home");
  const supabase = await createClient();
  const today = todayRome();

  const [agendaRes, { data: acc }, { data: profile }, { count: filesCount }, { data: unread }, { data: collab }, { data: mail }, { data: drafts }] = await Promise.all([
    // 60 giorni: servizi dei prossimi giorni e richieste da confermare anche più avanti
    supabase.rpc("network_agenda", { p_from: today, p_to: addDays(today, 60) }),
    supabase.rpc("network_accounting_briefing"),
    supabase.from("network_profiles").select("business_name, status, cover_path, logo_path, tagline, gallery, listed").eq("user_id", user.id).maybeSingle(),
    supabase.from("network_files").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.rpc("network_unread_count"),
    supabase.rpc("network_collab_pending_count"),
    supabase.rpc("mail_unread_count"),
    supabase.rpc("network_reminder_drafts"),
  ]);
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Rome" }));

  return (
    <SupplierHomeView
      me={user.id}
      today={today}
      hour={hour}
      agendaError={!!agendaRes.error}
      agenda={(agendaRes.data ?? []) as AgendaRow[]}
      acc={acc}
      profile={profile}
      filesCount={filesCount}
      unread={unread}
      collab={collab}
      mail={mail}
      pendingAgencies={((drafts ?? []) as { sent_at: string | null }[]).filter((d) => !d.sent_at).length}
    />
  );
}
