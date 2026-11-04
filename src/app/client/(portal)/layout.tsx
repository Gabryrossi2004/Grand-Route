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
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/client" className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Compass size={16} />
            </span>
            Area clienti
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {fullName && <span className="hidden px-1 text-slate-500 sm:inline">Ciao, {fullName.split(" ")[0]}</span>}
            <form action={clientSignOut}>
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
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
