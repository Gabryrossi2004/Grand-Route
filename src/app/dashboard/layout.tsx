import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";
import HeaderAutoHide from "@/components/HeaderAutoHide";
import FontPreference from "@/components/FontPreference";
import DashboardNav from "@/components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getCachedUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const brandColor = profile?.brand_color || "#233c5e";

  return (
    <div data-ui="agency" className="min-h-screen bg-[#faf3e6]">
      <FontPreference
        fontSize={profile?.ui_font_size ?? "normale"}
        fontFamily={profile?.ui_font_family ?? "predefinito"}
      />
      <HeaderAutoHide className="border-b border-[#e6d7bb] bg-[#faf3e6]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 text-[#233c5e]">
            {profile?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo_url} alt="" className="h-8 w-8 object-contain" />
            ) : (
              <span style={{ backgroundColor: brandColor }} className="h-2.5 w-2.5 rounded-full" />
            )}
            <span className="hidden font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:inline">
              {profile?.agency_name || "Il mio gestionale viaggi"}
            </span>
          </Link>
          <DashboardNav signOut={signOut} />
        </div>
      </HeaderAutoHide>
      <main className="mx-auto max-w-7xl px-3 py-10 sm:px-6">{children}</main>
    </div>
  );
}
