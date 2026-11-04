import Link from "next/link";
import { Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { clientSignOut } from "./actions";

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    fullName = data?.full_name ?? null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#faf3e6] via-[#f7efdd] to-[#edddb8]">
      <div className="pointer-events-none fixed -top-32 left-[-8%] h-96 w-96 rounded-full bg-[#2b333e]/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-8%] h-96 w-96 rounded-full bg-[#cda876]/20 blur-3xl" />
      <header className="sticky top-0 z-20 border-b border-[#e6d7bb] bg-[#faf3e6]/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/client" className="flex items-center gap-2 font-semibold text-[#2b333e]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2b333e] text-white">
              <Compass size={16} />
            </span>
            Area clienti
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {fullName && <span className="hidden px-1 text-[#6b5f4a] sm:inline">Ciao, {fullName.split(" ")[0]}</span>}
            <form action={clientSignOut}>
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
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
