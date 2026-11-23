import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import HeaderAutoHide from "@/components/HeaderAutoHide";
import { travelerSignOut } from "../actions";

export const metadata = { title: "Area viaggiatori" };

// Area dei viaggiatori privati. Chi non lo è viene rimandato alla sua area.
export default async function TravelerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCachedUser();
  if (!user) redirect("/viaggiatore/login");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, is_traveler, is_professional").eq("id", user.id).maybeSingle();
  if (profile && !profile.is_traveler) redirect(profile.is_professional ? "/dashboard" : "/client");

  const link = "rounded-full px-3 py-1.5 font-medium text-[#6b5f4a] transition hover:bg-[#faf3e6] hover:text-[#233c5e]";
  return (
    <div data-ui="client" className="relative min-h-screen bg-gradient-to-br from-[#faf3e6] via-[#f7efdd] to-[#edddb8]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 left-[-8%] h-96 w-96 rounded-full bg-[#233c5e]/10 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-8%] h-96 w-96 rounded-full bg-[#cda876]/20 blur-3xl" />
      </div>
      <HeaderAutoHide className="bg-[#faf3e6]/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4">
          <Link href="/viaggiatore" className="flex shrink-0 items-center gap-2 text-[#233c5e]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#cda876]" />
            <span className="hidden font-[family-name:var(--font-display)] text-base font-semibold tracking-wide min-[400px]:inline sm:text-xl">Grand Route</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-[#e6d7bb] bg-white p-1 text-[13px] sm:gap-1 sm:text-sm">
            <Link href="/viaggiatore" className={link}>
              Viaggi
            </Link>
            <Link href="/viaggiatore/nuovo" className={link}>
              Nuovo
            </Link>
            <form action={travelerSignOut}>
              <button type="submit" className="rounded-full px-3 py-1.5 font-medium text-[#756548] transition hover:bg-[#faf3e6] hover:text-[#233c5e]">
                Esci
              </button>
            </form>
          </nav>
        </div>
      </HeaderAutoHide>
      <main className="relative z-10 mx-auto max-w-4xl px-3 pb-16 pt-4 sm:px-4">{children}</main>
    </div>
  );
}
