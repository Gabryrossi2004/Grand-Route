import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import HeaderAutoHide from "@/components/HeaderAutoHide";
import { clientSignOut } from "./actions";
import { ClientSignOutForm, RegisterServiceWorker } from "@/components/ClientOfflineSupport";
import LanguageSwitch from "@/components/LanguageSwitch";
import { getT } from "@/lib/i18n/server";

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  const supabase = await createClient();
  const user = await getCachedUser();

  let fullName: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    fullName = data?.full_name ?? null;
  }

  return (
    <div
      data-ui="client"
      className="relative min-h-screen bg-gradient-to-br from-[#faf3e6] via-[#f7efdd] to-[#edddb8]"
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 left-[-8%] h-96 w-96 rounded-full bg-[#233c5e]/10 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-8%] h-96 w-96 rounded-full bg-[#cda876]/20 blur-3xl" />
      </div>
      <HeaderAutoHide className="bg-[#faf3e6]/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
          <Link href="/client" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[#233c5e]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#cda876]" />
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide sm:text-xl">
              {t("portal.title")}
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-[#e6d7bb] bg-white p-1 text-sm sm:gap-1">
            <Link
              href="/client"
              className="rounded-full px-2.5 py-1.5 font-medium sm:px-3.5 text-[#6b5f4a] transition hover:bg-[#faf3e6] hover:text-[#233c5e]"
            >
              {t("portal.nav.trips")}
            </Link>
            <Link
              href="/client/documenti"
              className="rounded-full px-2.5 py-1.5 font-medium sm:px-3.5 text-[#6b5f4a] transition hover:bg-[#faf3e6] hover:text-[#233c5e]"
            >
              {t("portal.nav.data")}
            </Link>
            <ClientSignOutForm
              action={clientSignOut}
              label={t("common.logout")}
              className="rounded-full px-2.5 py-1.5 font-medium sm:px-3.5 text-[#756548] transition hover:bg-[#faf3e6] hover:text-[#233c5e]"
            />
          </nav>
        </div>
      </HeaderAutoHide>
      <RegisterServiceWorker />
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-4">
        <div className="mb-3 flex justify-end print:hidden">
          <LanguageSwitch />
        </div>
        {children}
      </main>
    </div>
  );
}
