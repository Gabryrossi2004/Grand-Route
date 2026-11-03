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

  const brandColor = profile?.brand_color || "#2563eb";

  const navItems = [
    { href: "/dashboard/trips", label: "Viaggi" },
    { href: "/dashboard/clients", label: "Clienti" },
    { href: "/dashboard/settings", label: "Impostazioni" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard/trips" className="flex items-center gap-2 font-semibold text-slate-900">
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
                className="rounded-md px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
            <form action={signOut} className="ml-1">
              <button
                type="submit"
                className="rounded-md px-3 py-1.5 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
