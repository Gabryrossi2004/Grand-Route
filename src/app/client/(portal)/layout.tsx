import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import HeaderAutoHide from "@/components/HeaderAutoHide";
import { clientSignOut } from "./actions";

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await getCachedUser();

  let fullName: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    fullName = data?.full_name ?? null;
  }

  return (
    <div data-ui="client" className="min-h-screen bg-[#faf3e6]">
      <HeaderAutoHide className="bg-[#faf3e6]/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/client" className="flex items-center gap-2.5 text-[#233c5e]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#cda876]" />
            <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
              Area clienti
            </span>
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-[#e6d7bb] bg-white p-1 text-sm">
            <Link
              href="/client"
              className="rounded-full px-3.5 py-1.5 font-medium text-[#6b5f4a] transition hover:bg-[#faf3e6] hover:text-[#233c5e]"
            >
              I viaggi
            </Link>
            <Link
              href="/client/documenti"
              className="rounded-full px-3.5 py-1.5 font-medium text-[#6b5f4a] transition hover:bg-[#faf3e6] hover:text-[#233c5e]"
            >
              I tuoi dati
            </Link>
            <form action={clientSignOut}>
              <button
                type="submit"
                className="rounded-full px-3.5 py-1.5 font-medium text-[#8c7a5e] transition hover:bg-[#faf3e6] hover:text-[#233c5e]"
              >
                Esci
              </button>
            </form>
          </nav>
        </div>
      </HeaderAutoHide>
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-4">{children}</main>
    </div>
  );
}
