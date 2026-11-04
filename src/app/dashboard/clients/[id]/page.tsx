import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";
import ClientDetailsFields from "@/components/ClientDetailsFields";
import { deleteClient, linkTripToClient, unlinkTripFromClient, updateClient } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user?.id ?? "")
    .single();
  if (!client) notFound();

  const [{ data: trips }, { data: otherTrips }] = await Promise.all([
    supabase.from("trips").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase
      .from("trips")
      .select("id, title, destination")
      .eq("owner_id", user?.id ?? "")
      .or(`client_id.neq.${id},client_id.is.null`)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{client.full_name}</h1>
        <Link
          href={`/dashboard/clients/${id}/preview`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Eye size={15} /> Vedi come questo cliente
        </Link>
      </div>

      {client.user_id ? (
        <p className="-mt-4 text-xs text-green-600">
          Questo cliente ha già un account nell&apos;area clienti.
        </p>
      ) : (
        <p className="-mt-4 text-xs text-slate-400">
          Questo cliente non si è ancora registrato nell&apos;area clienti. Quando lo farà con questa email, vedrà
          subito i suoi viaggi.
        </p>
      )}

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

        <ClientDetailsFields client={client} />

        <button type="submit" className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Salva modifiche
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Viaggi di questo cliente</h2>
        {!trips || trips.length === 0 ? (
          <p className="mb-3 text-sm text-slate-400">Nessun viaggio collegato ancora.</p>
        ) : (
          <ul className="mb-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {(trips as Trip[]).map((trip) => (
              <li key={trip.id} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                <Link href={`/dashboard/trips/${trip.id}`} className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900">{trip.title}</span>
                  {trip.destination && <span className="text-sm text-slate-500"> · {trip.destination}</span>}
                </Link>
                <form action={unlinkTripFromClient.bind(null, id, trip.id)}>
                  <button type="submit" className="shrink-0 text-xs text-slate-400 hover:text-red-500 hover:underline">
                    Rimuovi associazione
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {otherTrips && otherTrips.length > 0 && (
          <form action={linkTripToClient.bind(null, id)} className="flex gap-2">
            <select
              name="trip_id"
              required
              defaultValue=""
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="" disabled>
                Associa un viaggio esistente…
              </option>
              {otherTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                  {trip.destination ? ` · ${trip.destination}` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Associa
            </button>
          </form>
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
