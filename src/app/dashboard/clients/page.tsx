import Link from "next/link";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import ClientsList from "@/components/ClientsList";
import LeadsPanel from "@/components/LeadsPanel";

export default async function ClientsPage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("owner_id", user?.id ?? "")
    .order("full_name", { ascending: true });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Clienti</h1>
        <Link
          href="/dashboard/clients/new"
          className="rounded-md bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f]"
        >
          + Nuovo cliente
        </Link>
      </div>

      <LeadsPanel ownerId={user?.id ?? ""} />

      <ClientsList clients={(clients as Client[]) || []} />
    </div>
  );
}
