import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import OpsSheet from "@/components/OpsSheet";
import { opsRange, opsToday, type OpsRow, type OpsView } from "@/lib/opsSheet";

export const metadata = { title: "Operativo day by day" };

const VIEWS: OpsView[] = ["giorno", "settimana", "mese"];

export default async function OperativoPage({ searchParams }: { searchParams: Promise<{ v?: string; d?: string }> }) {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const today = opsToday();
  const view: OpsView = VIEWS.includes(sp.v as OpsView) ? (sp.v as OpsView) : "mese";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") && !Number.isNaN(Date.parse(sp.d!)) ? sp.d! : today;
  const { from, to } = opsRange(view, anchor);

  const supabase = await createClient();
  const [rowsRes, { data: suppliers }, { data: clients }, { data: recent }] = await Promise.all([
    supabase
      .from("ops_rows")
      .select("id, service_date, client, agent, supplier, supplier_contact, pax, service, meeting_time, meeting_point, notes, responsible, row_color, cell_colors, trip_id, activity_id, created_at")
      .eq("owner_id", user.id)
      .gte("service_date", from)
      .lte("service_date", to)
      .order("service_date")
      .limit(5000),
    supabase.from("suppliers").select("full_name, phone").eq("owner_id", user.id).order("full_name").limit(2000),
    supabase.from("clients").select("full_name").eq("owner_id", user.id).order("full_name").limit(5000),
    // valori già usati negli altri periodi, per i suggerimenti mentre si scrive
    supabase.from("ops_rows").select("client, agent, supplier, responsible").eq("owner_id", user.id).order("service_date", { ascending: false }).limit(3000),
  ]);
  const distinct = (key: "client" | "agent" | "supplier" | "responsible") =>
    [...new Set(((recent ?? []) as Record<string, string>[]).map((r) => (r[key] ?? "").trim()).filter(Boolean))];

  if (rowsRes.error) {
    console.error("[operativo]", rowsRes.error.message);
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Operativo day by day</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Per attivare la scheda operativa serve un aggiornamento del database: esegui lo script <strong>0046_ops_sheet.sql</strong> nell&apos;SQL
          Editor di Supabase, poi ricarica questa pagina.
        </div>
      </div>
    );
  }

  return (
    <OpsSheet
      key={`${view}-${from}`}
      initialRows={(rowsRes.data ?? []) as OpsRow[]}
      view={view}
      anchor={anchor}
      from={from}
      to={to}
      today={today}
      suppliers={(suppliers ?? []).map((s) => ({ name: s.full_name as string, phone: (s.phone as string | null) ?? "" }))}
      clientNames={(clients ?? []).map((c) => c.full_name as string)}
      suggestions={{ client: distinct("client"), agent: distinct("agent"), supplier: distinct("supplier"), responsible: distinct("responsible") }}
    />
  );
}
