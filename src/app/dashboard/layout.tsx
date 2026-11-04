import Link from "next/link";
import { Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";

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

  const brandColor = profile?.brand_color || "#2b333e";

  const navItems = [
    { href: "/dashboard", label: "Home" },
    { href: "/dashboard/trips", label: "Viaggi" },
    { href: "/dashboard/clients", label: "Clienti" },
    { href: "/dashboard/calendar", label: "Calendario" },
    { href: "/dashboard/settings", label: "Impostazioni" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#faf3e6] via-[#f7efdd] to-[#edddb8]">
      <div className="pointer-events-none fixed -top-32 right-[-8%] h-96 w-96 rounded-full bg-[#cda876]/20 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] left-[-8%] h-96 w-96 rounded-full bg-[#2b333e]/10 blur-3xl" />
      <header className="sticky top-0 z-20 border-b border-[#e6d7bb] bg-[#faf3e6]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-[#2b333e]">
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
            {profile?.agency_name || "Il mio gestionale viaggi"}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 font-medium text-[#6b5f4a] transition hover:bg-[#f2e2c4] hover:text-[#2b333e]"
              >
                {item.label}
              </Link>
            ))}
            <form action={signOut} className="ml-1">
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 font-medium text-[#8c7a5e] transition hover:bg-[#f2e2c4] hover:text-[#2b333e]"
              >
                Esci
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
