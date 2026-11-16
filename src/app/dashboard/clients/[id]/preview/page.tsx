import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import ClientTripsGrid, { type TripWithAgency } from "@/components/ClientTripsGrid";

export default async function ClientPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user?.id ?? "")
    .single();
  if (!client) notFound();

  const { data: trips } = await supabase
    .from("trips")
    .select("*, profiles(agency_name, logo_url, brand_color)")
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

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-[#f2e2c4] bg-[#faf3e6] px-4 py-3">
        <Eye size={16} className="shrink-0 text-[#233c5e]" />
        <p className="text-sm text-[#11161b]">
          Stai vedendo in anteprima, in sola lettura, esattamente cosa vede <strong>{client.full_name}</strong> nella
          sua area clienti.
        </p>
      </div>

      <h1 className="mb-6 text-3xl font-medium tracking-tight text-[#233c5e]">I miei viaggi</h1>
      <ClientTripsGrid
        trips={(trips as TripWithAgency[]) || []}
        tripHref={(tripId) => `/dashboard/clients/${id}/preview/trips/${tripId}`}
        emptyMessage="Nessun viaggio collegato a questo cliente ancora."
      />
    </div>
  );
}
