import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ClientTripsGrid, { type TripWithAgency } from "@/components/ClientTripsGrid";

export default async function ClientPreviewPage({
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

  const { data: trips } = await supabase
    .from("trips")
    .select("*, profiles(agency_name, logo_url)")
    .eq("client_id", id)
    .order("start_date", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/dashboard/clients/${id}`}
        className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={14} /> Torna alla scheda cliente
      </Link>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <Eye size={16} className="shrink-0 text-blue-600" />
        <p className="text-sm text-blue-900">
          Stai vedendo in anteprima, in sola lettura, esattamente cosa vede <strong>{client.full_name}</strong> nella
          sua area clienti.
        </p>
      </div>

      <h1 className="mb-6 text-2xl font-semibold text-slate-900">I miei viaggi</h1>
      <ClientTripsGrid
        trips={(trips as TripWithAgency[]) || []}
        tripHref={(tripId) => `/dashboard/clients/${id}/preview/trips/${tripId}`}
        emptyMessage="Nessun viaggio collegato a questo cliente ancora."
      />
    </div>
  );
}
