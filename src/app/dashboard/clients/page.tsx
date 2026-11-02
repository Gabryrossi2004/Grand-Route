import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("full_name", { ascending: true });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Clienti</h1>
        <Link
          href="/dashboard/clients/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuovo cliente
        </Link>
      </div>

      {!clients || clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">Non hai ancora nessun cliente in rubrica.</p>
          <Link href="/dashboard/clients/new" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
            Aggiungi il primo cliente
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {(clients as Client[]).map((client) => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{client.full_name}</p>
                {client.email && <p className="text-sm text-slate-500">{client.email}</p>}
              </div>
              {client.phone && <p className="text-sm text-slate-400">{client.phone}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
