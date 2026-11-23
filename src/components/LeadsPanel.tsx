import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { convertLead, setLeadStatus } from "@/app/dashboard/settings/vantaggi/actions";

type Lead = { id: string; name: string; contact: string; message: string | null; status: string; created_at: string; referrer_client_id: string | null; source?: string; trip_id?: string | null };

// Richieste arrivate da «presenta un amico», dai preventivi dei clienti e dai viaggiatori privati
export default async function LeadsPanel({ ownerId }: { ownerId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_leads")
    .select("*")
    .eq("owner_id", ownerId)
    .in("status", ["nuova", "contattata"])
    .order("created_at", { ascending: false })
    .limit(30);
  const leads = (data as Lead[] | null) ?? [];
  if (error || leads.length === 0) return null;
  const refIds = [...new Set(leads.map((l) => l.referrer_client_id).filter(Boolean))] as string[];
  const { data: refs } = refIds.length ? await supabase.from("clients").select("id, full_name").in("id", refIds) : { data: [] };
  const refName = new Map(((refs as { id: string; full_name: string }[] | null) ?? []).map((r) => [r.id, r.full_name]));

  return (
    <section className="mb-6 rounded-2xl border border-[#e3b04b] bg-white p-4">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-[#233c5e]">
        <UserPlus size={18} className="text-[#c58f2d]" /> Nuove richieste ({leads.length})
      </h2>
      <p className="mb-3 text-xs text-slate-500">Amici presentati dai tuoi clienti, clienti che chiedono un preventivo e viaggiatori che ti mandano il loro itinerario da organizzare (lo trovi già tra i tuoi viaggi). «Diventa cliente» crea la scheda, dà il bonus a chi ha presentato l&apos;amico e collega il viaggio.</p>
      <ul className="flex flex-col divide-y divide-[#f0e6d2]">
        {leads.map((l) => (
          <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                {l.name} <span className="font-normal text-slate-600">· {l.contact}</span>
                {l.status === "contattata" && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">contattata</span>}
              </p>
              <p className="text-xs text-slate-500">
                {l.source === "cliente"
                  ? "Richiesta di preventivo di un tuo cliente · "
                  : l.source === "privato"
                    ? "Viaggiatore dall'area viaggiatori · "
                    : l.referrer_client_id && refName.get(l.referrer_client_id)
                    ? `Presentato da ${refName.get(l.referrer_client_id)} · `
                    : ""}
                {new Date(l.created_at).toLocaleDateString("it-IT")}
              </p>
              {l.message && <p className="mt-0.5 text-slate-600">«{l.message}»</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {l.source === "cliente" && l.referrer_client_id ? (
                <a href={`/dashboard/clients/${l.referrer_client_id}`} className="rounded-lg bg-[#233c5e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#17283f]">
                  Apri il cliente
                </a>
              ) : (
                <>
                  {l.source === "privato" && l.trip_id && (
                    <a href={`/dashboard/trips/${l.trip_id}`} className="rounded-lg border border-[#233c5e] px-3 py-1.5 text-xs font-semibold text-[#233c5e] hover:bg-[#eef2f8]">
                      Apri l&apos;itinerario
                    </a>
                  )}
                <form action={convertLead.bind(null, l.id)}>
                  <button type="submit" className="rounded-lg bg-[#233c5e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#17283f]">Diventa cliente</button>
                </form>
                </>
              )}
              {l.status === "nuova" && (
                <form action={setLeadStatus.bind(null, l.id, "contattata")}>
                  <button type="submit" className="text-xs font-medium text-[#233c5e] hover:underline">Contattata</button>
                </form>
              )}
              <form action={setLeadStatus.bind(null, l.id, "archiviata")}>
                <button type="submit" className="text-xs font-medium text-slate-500 hover:underline">Archivia</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
