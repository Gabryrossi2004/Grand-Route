import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import { decryptField } from "@/lib/encryption";
import type { Client, Trip } from "@/lib/types";
import ClientDetailsFields from "@/components/ClientDetailsFields";
import ClientLoyaltyCard from "@/components/ClientLoyaltyCard";
import SubmitButton from "@/components/SubmitButton";
import { deleteClient, linkTripToClient, unlinkTripFromClient, updateClient } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // Dati dell'agenzia (per un collaboratore: quelli dell'agenzia in cui lavora)
  const companyId = (await getTeamContext())?.companyId ?? "";

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("owner_id", companyId)
    .single();
  if (!client) notFound();

  // I dati anagrafici/documenti sono cifrati nel database: vanno decifrati
  // qui, lato server, solo per mostrarli al proprietario di questa scheda.
  const decryptedClient: Client = {
    ...client,
    date_of_birth: decryptField(client.date_of_birth),
    place_of_birth: decryptField(client.place_of_birth),
    nationality: decryptField(client.nationality),
    fiscal_code: decryptField(client.fiscal_code),
    residence_address: decryptField(client.residence_address),
    id_card_number: decryptField(client.id_card_number),
    id_card_expiry: decryptField(client.id_card_expiry),
    passport_number: decryptField(client.passport_number),
    passport_expiry: decryptField(client.passport_expiry),
  };

  const [{ data: trips }, { data: otherTrips }] = await Promise.all([
    supabase.from("trips").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase
      .from("trips")
      .select("id, title, destination")
      .eq("owner_id", companyId)
      .or(`client_id.neq.${id},client_id.is.null`)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">{client.full_name}</h1>
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
        <p className="-mt-4 text-xs text-slate-500">
          Questo cliente non si è ancora registrato nell&apos;area clienti. Quando lo farà con questa email, vedrà
          subito i suoi viaggi.
        </p>
      )}

      <form action={updateClient.bind(null, id)} className="flex flex-col gap-4 rounded-xl border border-[#e6d7bb] bg-white p-6">
        <div>
          <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-slate-700">
            Nome e cognome
          </label>
          <input
            id="full_name"
            name="full_name"
            defaultValue={client.full_name}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </div>

        <ClientDetailsFields client={decryptedClient} />

        <SubmitButton
          pendingLabel="Salvataggio…"
          className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Salva modifiche
        </SubmitButton>
      </form>

      <ClientLoyaltyCard clientId={id} ownerId={companyId} />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Viaggi di questo cliente</h2>
        {!trips || trips.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">Nessun viaggio collegato ancora.</p>
        ) : (
          <ul className="mb-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-[#e6d7bb] bg-white">
            {(trips as Trip[]).map((trip) => (
              <li key={trip.id} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                <Link href={`/dashboard/trips/${trip.id}`} className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900">{trip.title}</span>
                  {trip.destination && <span className="text-sm text-slate-500"> · {trip.destination}</span>}
                </Link>
                <form action={unlinkTripFromClient.bind(null, id, trip.id)}>
                  <SubmitButton
                    pendingLabel="Rimozione…"
                    className="shrink-0 text-xs text-slate-500 hover:text-red-500 hover:underline disabled:opacity-60"
                  >
                    Rimuovi associazione
                  </SubmitButton>
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
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]"
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
            <SubmitButton
              pendingLabel="Associazione…"
              className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Associa
            </SubmitButton>
          </form>
        )}
      </section>

      <form action={deleteClient.bind(null, id)}>
        <SubmitButton pendingLabel="Eliminazione…" className="text-sm text-red-500 hover:underline disabled:opacity-60">
          Elimina cliente
        </SubmitButton>
      </form>
    </div>
  );
}
