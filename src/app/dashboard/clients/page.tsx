import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import ClientsList from "@/components/ClientsList";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("owner_id", user?.id ?? "")
    .order("full_name", { ascending: true });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="border-l-4 border-[#2b333e] pl-3 text-2xl font-semibold text-slate-900">Clienti</h1>
        <Link
          href="/dashboard/clients/new"
          className="rounded-md bg-[#2b333e] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e242d]"
        >
          + Nuovo cliente
        </Link>
      </div>

      <ClientsList clients={(clients as Client[]) || []} />
    </div>
  );
}
