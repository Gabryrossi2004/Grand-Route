import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";
import { deleteClient, updateClient } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!client) notFound();

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold text-slate-900">{client.full_name}</h1>

      <form action={updateClient.bind(null, id)} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-slate-700">
            Nome e cognome
          </label>
          <input
            id="full_name"
            name="full_name"
            defaultValue={client.full_name}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={client.email ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
            Telefono
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={client.phone ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
            Note
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={client.notes ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <button type="submit" className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Salva modifiche
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Viaggi di questo cliente</h2>
        {!trips || trips.length === 0 ? (
          <p className="text-sm text-slate-400">Nessun viaggio collegato ancora.</p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {(trips as Trip[]).map((trip) => (
              <li key={trip.id}>
                <Link href={`/dashboard/trips/${trip.id}`} className="block px-4 py-3 hover:bg-slate-50">
                  <span className="font-medium text-slate-900">{trip.title}</span>
                  {trip.destination && <span className="text-sm text-slate-500"> · {trip.destination}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={deleteClient.bind(null, id)}>
        <button type="submit" className="text-sm text-red-500 hover:underline">
          Elimina cliente
        </button>
      </form>
    </div>
  );
}
