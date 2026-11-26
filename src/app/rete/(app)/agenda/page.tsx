import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import AgendaView from "@/components/network/AgendaView";
import type { ReminderDraft } from "@/components/network/ReminderDrafts";
import type { CalEvent } from "@/components/network/CalendarEvents";
import { todayRome } from "@/lib/orders/shared";
import { agendaRange, isIsoDate, type AgendaRow } from "@/lib/network/agenda";

export const metadata = { title: "Agenda" };

// Agenda dei servizi: qui si caricano i dati, la pagina è in AgendaView
export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ vista?: string; data?: string }> }) {
  const user = await getCachedUser();
  if (!user) redirect("/professionisti?next=/rete/agenda");
  const { vista: v, data } = await searchParams;
  const vista = v === "mese" ? "mese" : "settimana";
  const today = todayRome();
  const ref = isIsoDate(data) ? data : today;
  const { from, to } = agendaRange(vista, ref);
  const supabase = await createClient();
  const [{ data: rows, error }, { data: prefs }, { data: drafts }, { data: events }, { data: np }, { data: pf }, { data: sh }] = await Promise.all([
    supabase.rpc("network_agenda", { p_from: from, p_to: to }),
    supabase.from("network_prefs").select("reminder_mode, reminder_subject, reminder_intro, reminder_outro").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("network_reminder_drafts"),
    supabase.from("network_calendar_events").select("id, kind, title, day_from, day_to").lte("day_from", to).gte("day_to", from).order("day_from"),
    supabase.from("network_profiles").select("business_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("agency_name, full_name").eq("id", user.id).maybeSingle(),
    supabase.from("network_prefs").select("share_availability, share_busy").eq("user_id", user.id).maybeSingle(),
  ]);
  const shr = sh as { share_availability?: boolean; share_busy?: boolean } | null;
  const pr = prefs as { reminder_mode?: "auto" | "manual" | "off"; reminder_subject?: string | null; reminder_intro?: string | null; reminder_outro?: string | null } | null;
  const sellerName = (np as { business_name?: string } | null)?.business_name || (pf as { agency_name?: string; full_name?: string } | null)?.agency_name || (pf as { full_name?: string } | null)?.full_name || "";
  return (
    <AgendaView
      me={user.id}
      today={today}
      vista={vista}
      refDate={ref}
      rows={(rows ?? []) as AgendaRow[]}
      error={!!error}
      prefs={{ mode: pr?.reminder_mode ?? "auto", subject: pr?.reminder_subject ?? "", intro: pr?.reminder_intro ?? "", outro: pr?.reminder_outro ?? "" }}
      drafts={((drafts ?? []) as ReminderDraft[])}
      events={((events ?? []) as CalEvent[])}
      sellerName={sellerName}
      share={{ on: !!shr?.share_availability, busy: !!shr?.share_busy }}
    />
  );
}
