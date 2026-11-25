import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Search, UserRound } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import HeaderAutoHide from "@/components/HeaderAutoHide";
import MobileTabBar from "@/components/MobileTabBar";
import { adoptSignupDraft } from "@/lib/network/server";
import { isTradeKind } from "@/lib/network/kinds";
import { redirectIfSuspended } from "@/lib/suspension";

export const metadata = { title: "Rete professionale" };

// La Rete dei professionisti del turismo: elenco, richieste di contatto e profilo.
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
  const { data: unread } = await supabase.rpc("network_unread_count");
  const unreadCount = typeof unread === "number" ? unread : 0;
  const trade = isTradeKind(p?.business_kind);

  const link = "rounded-full px-3 py-1.5 font-medium text-[#6b5f4a] transition hover:bg-[#faf3e6] hover:text-[#233c5e]";
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
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide sm:text-xl">Grand Route · Rete</span>
          </Link>
          <form action={signOut} className="sm:hidden">
            <button type="submit" className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 text-[13px] font-medium text-[#756548]">
              Esci
            </button>
          </form>
          <nav className="hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#e6d7bb] bg-white p-1 text-sm sm:flex">
            <Link href="/rete" className={link}>Cerca</Link>
            <Link href="/rete/messaggi" className={link}>
              Messaggi{unreadCount > 0 && <span className="ml-1.5 rounded-full bg-[#c0392b] px-1.5 py-0.5 text-[11px] font-semibold text-white">{unreadCount}</span>}
            </Link>
            <Link href="/rete/profilo" className={link}>Il mio profilo</Link>
            {trade && <Link href="/dashboard" className={link}>Gestionale</Link>}
            <form action={signOut}>
              <button type="submit" className="rounded-full px-3 py-1.5 font-medium text-[#756548] transition hover:bg-[#faf3e6] hover:text-[#233c5e]">Esci</button>
            </form>
          </nav>
        </div>
      </HeaderAutoHide>
      <MobileTabBar
        items={[
          { href: "/rete", label: "Cerca", icon: <Search size={19} />, exact: true },
          { href: "/rete/messaggi", label: "Messaggi", icon: <Inbox size={19} /> },
          { href: "/rete/profilo", label: "Profilo", icon: <UserRound size={19} /> },
        ]}
      />
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:pb-12">{children}</main>
    </div>
  );
}
