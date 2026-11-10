import Link from "next/link";
import { Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";
import HeaderAutoHide from "@/components/HeaderAutoHide";
import FontPreference from "@/components/FontPreference";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const navItems = [
    { href: "/dashboard", label: "Home" },
    { href: "/dashboard/trips", label: "Viaggi" },
    { href: "/dashboard/clients", label: "Clienti" },
    { href: "/dashboard/suppliers", label: "Fornitori" },
    { href: "/dashboard/community", label: "Community" },
    { href: "/dashboard/calendar", label: "Calendario" },
    { href: "/dashboard/settings", label: "Impostazioni" },
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#faf3e6] via-[#f7efdd] to-[#edddb8]">
      <FontPreference
        fontSize={profile?.ui_font_size ?? "normale"}
        fontFamily={profile?.ui_font_family ?? "predefinito"}
      />
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 right-[-8%] h-96 w-96 rounded-full bg-[#cda876]/20 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[-8%] h-96 w-96 rounded-full bg-[#233c5e]/10 blur-3xl" />
      </div>
      <HeaderAutoHide className="border-b border-[#e6d7bb] bg-[#faf3e6]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-semibold text-[#233c5e]">
            {profile?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <span
                style={{ backgroundColor: brandColor }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
              >
                <Compass size={16} />
              </span>
            )}
            <span className="hidden font-[family-name:var(--font-display)] sm:inline">
              {profile?.agency_name || "Il mio gestionale viaggi"}
            </span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-[#6b5f4a] transition hover:bg-[#f2e2c4] hover:text-[#233c5e]"
              >
                {item.label}
              </Link>
            ))}
            <form action={signOut} className="ml-1 shrink-0">
              <button
                type="submit"
                className="whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-[#8c7a5e] transition hover:bg-[#f2e2c4] hover:text-[#233c5e]"
              >
                Esci
              </button>
            </form>
          </nav>
        </div>
      </HeaderAutoHide>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
