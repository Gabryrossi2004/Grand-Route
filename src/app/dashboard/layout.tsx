import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";
import HeaderAutoHide from "@/components/HeaderAutoHide";
import FontPreference from "@/components/FontPreference";
import DashboardNav from "@/components/DashboardNav";
import AgencyLogo from "@/components/AgencyLogo";
import { parseLogoShape } from "@/lib/logoShape";
import ZefiroFloating from "@/components/ZefiroFloating";
import { getAvatarStyle, isAvatarVisible } from "@/lib/assistant";
import { ZefiroStyleProvider } from "@/components/ZefiroStyle";
import { isTradeKind } from "@/lib/network/kinds";
import { adoptSignupDraft } from "@/lib/network/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getCachedUser();

  let profile: Profile | null = null;
  let unreadMessages = 0;
  if (user) {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      // Messaggi dei clienti non ancora letti (0 se la chat non è ancora attiva)
      supabase
        .from("trip_messages")
        .select("id", { count: "exact", head: true })
        .eq("author_role", "client")
        .is("read_at", null)
        .neq("author_id", user.id),
    ]);
    profile = data;
    unreadMessages = count ?? 0;
  }
  // I viaggiatori privati hanno la loro area
  if ((profile as { is_traveler?: boolean } | null)?.is_traveler) redirect("/viaggiatore");
  // I fornitori (guide, autisti, strutture...) usano solo la Rete
  if (!isTradeKind((profile as { business_kind?: string | null } | null)?.business_kind)) redirect("/rete");
  // Chi si è registrato con i dati dell'attività li trova già nel profilo della Rete
  await adoptSignupDraft();

  const brandColor = profile?.brand_color || "#233c5e";

  return (
    <ZefiroStyleProvider mode={getAvatarStyle(profile?.ai_preferences)}>
    <div
      data-ui="agency"
      className="relative min-h-screen bg-gradient-to-br from-[#faf3e6] via-[#f7efdd] to-[#edddb8]"
    >
      <FontPreference
        fontSize={profile?.ui_font_size ?? "normale"}
        fontFamily={profile?.ui_font_family ?? "predefinito"}
      />
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 right-[-8%] h-96 w-96 rounded-full bg-[#cda876]/20 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[-8%] h-96 w-96 rounded-full bg-[#233c5e]/10 blur-3xl" />
      </div>
      <HeaderAutoHide className="border-b border-[#e6d7bb] bg-[#faf3e6]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 text-[#233c5e]">
            {profile?.logo_url ? (
              <AgencyLogo src={profile.logo_url} shape={parseLogoShape(profile.logo_shape)} size={44} />
            ) : (
              <span style={{ backgroundColor: brandColor }} className="h-2.5 w-2.5 rounded-full" />
            )}
            <span className="hidden font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:inline">
              {profile?.agency_name || "Il mio gestionale viaggi"}
            </span>
          </Link>
          <DashboardNav signOut={signOut} unreadMessages={unreadMessages} />
        </div>
      </HeaderAutoHide>
      <main className="mx-auto max-w-7xl px-3 py-10 sm:px-6">{children}</main>
      {isAvatarVisible(profile?.ai_preferences) && <ZefiroFloating />}
    </div>
    </ZefiroStyleProvider>
  );
}
