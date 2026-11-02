import Link from "next/link";
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

  const navItems = [
    { href: "/dashboard/trips", label: "Viaggi" },
    { href: "/dashboard/clients", label: "Clienti" },
    { href: "/dashboard/settings", label: "Impostazioni" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard/trips" className="font-semibold text-slate-900">
            {profile?.agency_name || "Il mio gestionale viaggi"}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-slate-600 hover:text-slate-900">
                {item.label}
              </Link>
            ))}
            <form action={signOut}>
              <button type="submit" className="text-slate-500 hover:text-slate-900">
                Esci
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
