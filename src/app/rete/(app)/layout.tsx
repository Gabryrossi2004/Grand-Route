import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Inbox, Mail, Search, UserRound } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import HeaderAutoHide from "@/components/HeaderAutoHide";
import MobileTabBar from "@/components/MobileTabBar";
import PartnerNav from "@/components/network/PartnerNav";
import { adoptSignupDraft } from "@/lib/network/server";
import { isTradeKind } from "@/lib/network/kinds";
import { redirectIfSuspended } from "@/lib/suspension";

export const metadata = { title: "Partner" };

// Sezione Partner (la rete dei professionisti del turismo): elenco, posta, richieste, servizi e profilo.
// Vi entrano agenzie, tour operator e fornitori (guide, autisti, strutture...). Viaggiatori e clienti no.
export default async function NetworkLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser();
  if (!user) redirect("/login?next=/rete");
  await redirectIfSuspended();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("is_traveler, is_professional, business_kind").eq("id", user.id).maybeSingle();
  const p = profile as { is_traveler?: boolean; is_professional?: boolean; business_kind?: string | null } | null;
  if (p?.is_traveler) redirect("/viaggiatore");
  if (p && p.is_professional === false) redirect("/client");

  await adoptSignupDraft();
  const [{ data: unread }, { data: collabPending }, { data: mailCount }, { data: todo }] = await Promise.all([
    supabase.rpc("network_unread_count"),
    supabase.rpc("network_collab_pending_count"),
    supabase.rpc("mail_unread_count"),
    // ordini e variazioni da gestire (0 se la migrazione 0065 non c'è ancora)
    supabase.rpc("network_todo_counts"),
  ]);
  const t = (todo as { seller?: number; buyer?: number } | null) ?? {};
  const jobsCount = (Number(t.seller) || 0) + (Number(t.buyer) || 0);
  const mailUnread = typeof mailCount === "number" ? mailCount : 0;
  const unreadCount = (typeof unread === "number" ? unread : 0) + (typeof collabPending === "number" ? collabPending : 0);
  const trade = isTradeKind(p?.business_kind);

  return (
    <div data-ui="client" className="relative min-h-screen bg-gradient-to-br from-[#faf3e6] via-[#f7efdd] to-[#edddb8]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 left-[-8%] h-96 w-96 rounded-full bg-[#233c5e]/10 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-8%] h-96 w-96 rounded-full bg-[#cda876]/20 blur-3xl" />
      </div>
      <HeaderAutoHide className="bg-[#faf3e6]/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4">
          <Link href="/rete" className="flex shrink-0 items-center gap-2 text-[#233c5e]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#cda876]" />
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide sm:text-xl">Grand Route · Partner</span>
          </Link>
          <form action={signOut} className="sm:hidden">
            <button type="submit" className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 text-[13px] font-medium text-[#756548]">
              Esci
            </button>
          </form>
          <PartnerNav
            items={[
              { href: "/rete", label: "Trova" },
              // la Posta di agenzie e tour operator sta nel gestionale, in Messaggi
              ...(trade ? [] : [{ href: "/rete/posta", label: "Posta", badge: mailUnread }]),
              { href: "/rete/messaggi", label: "Richieste", badge: unreadCount },
              { href: "/rete/lavori", label: "Servizi", badge: jobsCount, also: ["/rete/fatture"] },
              { href: "/rete/profilo", label: "Il mio profilo" },
              ...(trade ? [{ href: "/dashboard", label: "Gestionale" }] : []),
            ]}
          >
            <form action={signOut}>
              <button type="submit" className="rounded-full px-3 py-1.5 font-medium text-[#756548] transition hover:bg-[#faf3e6] hover:text-[#233c5e]">Esci</button>
            </form>
          </PartnerNav>
        </div>
      </HeaderAutoHide>
      <MobileTabBar
        items={[
          { href: "/rete", label: "Trova", icon: <Search size={19} />, exact: true, also: [] },
          ...(trade ? [] : [{ href: "/rete/posta", label: "Posta", icon: <Mail size={19} />, badge: mailUnread }]),
          { href: "/rete/messaggi", label: "Richieste", icon: <Inbox size={19} />, badge: unreadCount },
          { href: "/rete/lavori", label: "Servizi", icon: <Briefcase size={19} />, badge: jobsCount, also: ["/rete/fatture"] },
          { href: "/rete/profilo", label: "Profilo", icon: <UserRound size={19} /> },
        ]}
      />
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:pb-12">{children}</main>
    </div>
  );
}
