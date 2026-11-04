"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Client } from "@/lib/types";

export default function ClientsList({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => {
      const haystack = `${client.full_name} ${client.email ?? ""} ${client.phone ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, query]);

  return (
    <div>
      {clients.length > 0 && (
        <div className="relative mb-5 max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome, email o telefono…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
          />
        </div>
      )}

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-500">Non hai ancora nessun cliente in rubrica.</p>
          <Link href="/dashboard/clients/new" className="mt-3 inline-block text-sm font-medium text-[#2b333e] hover:underline">
            Aggiungi il primo cliente
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400">Nessun cliente corrisponde alla ricerca.</p>
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtered.map((client) => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2b333e] text-sm font-semibold text-white">
                  {client.full_name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{client.full_name}</p>
                  {client.email && <p className="truncate text-sm text-slate-500">{client.email}</p>}
                </div>
              </div>
              {client.phone && <p className="shrink-0 text-sm text-slate-400">{client.phone}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
