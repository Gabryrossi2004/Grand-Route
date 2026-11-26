import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import OpsSheet from "@/components/OpsSheet";
import { syncImportedRows } from "@/lib/opsImport";
import { normalizeTripCode, opsRange, opsToday, TRIP_CODE_RE, type OpsRow, type OpsSource, type OpsTripRef, type OpsView } from "@/lib/opsSheet";

// controlla gli itinerari e aggiorna le righe importate (può richiedere qualche secondo con molti viaggi)
export const maxDuration = 30;

export const metadata = { title: "Operativo day by day" };

const VIEWS: OpsView[] = ["giorno", "settimana", "mese"];
const ROW_FIELDS =
  "id, service_date, trip_code, client, agent, supplier, supplier_contact, pax, service, meeting_time, meeting_point, notes, responsible, status, changes, source, row_color, cell_colors, trip_id, activity_id, created_at";

type TripRow = { id: string; code: string | null; title: string; start_date: string | null; end_date: string | null; clients: { full_name: string | null } | null };

export default async function OperativoPage({ searchParams }: { searchParams: Promise<{ v?: string; d?: string; codice?: string; riconferme?: string }> }) {
  const user = await getCachedUser();
  if (!user) redirect("/professionisti");
  const sp = await searchParams;
  const today = opsToday();
  const supabase = await createClient();

  const [{ data: profile }, { data: suppliers }, { data: clients }, { data: recent }, tripsRes] = await Promise.all([
    supabase.from("profiles").select("ai_preferences, agency_name").eq("id", user.id).maybeSingle(),
    supabase.from("suppliers").select("full_name, phone, email").eq("owner_id", user.id).order("full_name").limit(2000),
    supabase.from("clients").select("full_name").eq("owner_id", user.id).order("full_name").limit(5000),
    // valori già usati negli altri periodi, per i suggerimenti mentre si scrive
    supabase.from("ops_rows").select("client, agent, supplier, responsible").eq("owner_id", user.id).order("service_date", { ascending: false }).limit(3000),
    supabase
      .from("trips")
      .select("id, code, title, start_date, end_date, clients(full_name)")
      .eq("owner_id", user.id)
      .not("code", "is", null)
      .order("start_date", { ascending: false, nullsFirst: false })
      .limit(3000),
  ]);
  const trips: OpsTripRef[] = ((tripsRes.data ?? []) as unknown as TripRow[]).map((t) => ({
    id: t.id,
    code: t.code ?? "",
    title: t.title,
    client: t.clients?.full_name ?? "",
    start: t.start_date,
    end: t.end_date,
  }));

  // ?codice=XXXXXX: tutte le righe di quel viaggio, qualunque sia la data
  const code = normalizeTripCode(sp.codice ?? "");
  const trip = TRIP_CODE_RE.test(code) ? trips.find((t) => t.code === code) : undefined;

  let view: OpsView = VIEWS.includes(sp.v as OpsView) ? (sp.v as OpsView) : "mese";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") && !Number.isNaN(Date.parse(sp.d!)) ? sp.d! : (trip?.start ?? today);
  let { from, to } = opsRange(view, anchor);

  let query = supabase.from("ops_rows").select(ROW_FIELDS).eq("owner_id", user.id);
  if (trip) {
    view = "viaggio";
    from = trip.start ?? today;
    to = trip.end ?? from;
    query = query.or(`trip_code.eq.${trip.code},trip_id.eq.${trip.id}`);
  } else {
    query = query.gte("service_date", from).lte("service_date", to);
  }
  const rowsRes = await query.order("service_date").limit(5000);

  if (rowsRes.error || tripsRes.error) {
    console.error("[operativo]", rowsRes.error?.message ?? tripsRes.error?.message);
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Operativo day by day</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Per usare la scheda operativa serve un aggiornamento del database: esegui nell&apos;SQL Editor di Supabase gli script che mancano tra{" "}
          <strong>0046_ops_sheet.sql</strong>, <strong>0047_trip_code.sql</strong> e <strong>0048_ops_status.sql</strong>, poi ricarica questa pagina.
        </div>
      </div>
    );
  }

  // righe importate: si allineano all'itinerario di adesso (le modifiche fatte a mano restano)
  const rows = await syncImportedRows(supabase, (rowsRes.data ?? []) as unknown as (OpsRow & { source: OpsSource | null })[]);

  const distinct = (key: "client" | "agent" | "supplier" | "responsible") =>
    [...new Set(((recent ?? []) as Record<string, string>[]).map((r) => (r[key] ?? "").trim()).filter(Boolean))];

  return (
    <OpsSheet
      key={`${view}-${from}-${trip?.id ?? ""}`}
      initialRows={rows}
      openRiconferme={sp.riconferme === "1"}
      agencyName={(profile?.agency_name as string | null) ?? ""}
      view={view}
      anchor={anchor}
      from={from}
      to={to}
      today={today}
      trip={trip ?? null}
      missingCode={code && !trip ? code : null}
      trips={trips}
      importEnabled={(profile?.ai_preferences as Record<string, string> | null)?.ops_import === "on"}
      suppliers={(suppliers ?? []).map((s) => ({ name: s.full_name as string, phone: (s.phone as string | null) ?? "", email: (s.email as string | null) ?? "" }))}
      clientNames={(clients ?? []).map((c) => c.full_name as string)}
      suggestions={{ client: distinct("client"), agent: distinct("agent"), supplier: distinct("supplier"), responsible: distinct("responsible") }}
    />
  );
}
