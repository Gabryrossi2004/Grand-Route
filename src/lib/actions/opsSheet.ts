"use server";

import { z } from "zod";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { companyIdOf } from "@/lib/team";
import { OPS_COLORS, OPS_SOURCE_KEYS, OPS_STATUS_IDS, OPS_TEXT_KEYS, type OpsRow, type OpsStatus } from "@/lib/opsSheet";
import { DAY_BLOCK_TITLE } from "@/lib/itineraryMode";
import { chunks, loadServices, nightsBetween, sourceFromActivity, type ImportActivity, type ImportDay } from "@/lib/opsImport";

type Fail = { ok: false; error: string };
const NOT_READY = "La scheda operativa non è ancora attiva: serve l'aggiornamento del database (SQL 0046).";
const SAVE_ERROR = "Non sono riuscito a salvare. Controlla la connessione e riprova.";

const color = z.enum(OPS_COLORS).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const textFields = Object.fromEntries(OPS_TEXT_KEYS.map((k) => [k, z.string().max(k === "notes" || k === "service" ? 4000 : 500)])) as Record<
  (typeof OPS_TEXT_KEYS)[number],
  z.ZodString
>;
const cellColors = z.partialRecord(z.enum(OPS_TEXT_KEYS), z.enum(OPS_COLORS));

const status = z.enum(["", ...OPS_STATUS_IDS]);
const change = z.object({ from: z.string().max(4000), to: z.string().max(4000), applied: z.boolean() });
const changesSchema = z.partialRecord(z.enum([...OPS_SOURCE_KEYS, "_removed"]), change);

const patchSchema = z
  .object({ service_date: date, row_color: color, cell_colors: cellColors, trip_id: z.string().uuid().nullable(), status, changes: changesSchema, ...textFields })
  .partial()
  .strict();

const rowSchema = z
  .object({
    id: z.string().uuid(),
    service_date: date,
    row_color: color.optional(),
    cell_colors: cellColors.optional(),
    status: status.optional(),
    trip_id: z.string().uuid().nullable().optional(),
    activity_id: z.string().uuid().nullable().optional(),
    ...Object.fromEntries(OPS_TEXT_KEYS.map((k) => [k, textFields[k].optional()])),
  })
  .strict();

const SELECT =
  "id, service_date, trip_code, client, agent, supplier, supplier_contact, pax, service, meeting_time, meeting_point, notes, responsible, status, changes, row_color, cell_colors, trip_id, activity_id, created_at";

// companyId: l'agenzia (per un collaboratore: quella in cui lavora), a cui appartengono le righe
async function ctx() {
  const user = await getCachedUser();
  if (!user) return null;
  return { user, companyId: await companyIdOf(user.id), supabase: await createClient() };
}

export async function createOpsRow(input: unknown): Promise<{ ok: true; row: OpsRow } | Fail> {
  const parsed = rowSchema.safeParse(input);
  const c = await ctx();
  if (!c || !parsed.success) return { ok: false, error: "Dati non validi." };
  const { data, error } = await c.supabase
    .from("ops_rows")
    .insert({ ...parsed.data, owner_id: c.companyId })
    .select(SELECT)
    .single();
  if (error) {
    console.error("[operativo] create", error.message);
    return { ok: false, error: error.code === "42P01" ? NOT_READY : SAVE_ERROR };
  }
  return { ok: true, row: data as OpsRow };
}

export async function updateOpsRow(id: string, patch: unknown): Promise<{ ok: true } | Fail> {
  const parsed = patchSchema.safeParse(patch);
  const c = await ctx();
  if (!c || !parsed.success || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Dati non validi." };
  const { error } = await c.supabase
    .from("ops_rows")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", c.companyId);
  if (error) {
    console.error("[operativo] update", error.message);
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export async function deleteOpsRow(id: string): Promise<{ ok: true } | Fail> {
  const c = await ctx();
  if (!c || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Dati non validi." };
  const { error } = await c.supabase.from("ops_rows").delete().eq("id", id).eq("owner_id", c.companyId);
  if (error) {
    console.error("[operativo] delete", error.message);
    return { ok: false, error: "Non sono riuscito a eliminare la riga. Riprova." };
  }
  return { ok: true };
}

// ── Stato e riconferme ──────────────────────────────────────────────────────

/** Cambia lo stato di più righe insieme (es. «Riconferma inviata» a tutti i servizi di un fornitore). */
export async function setOpsStatus(ids: string[], next: OpsStatus | ""): Promise<{ ok: true } | Fail> {
  const c = await ctx();
  const parsedIds = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
  if (!c || !parsedIds.success || !status.safeParse(next).success) return { ok: false, error: "Dati non validi." };
  const { error } = await c.supabase
    .from("ops_rows")
    .update({ status: next, updated_at: new Date().toISOString() })
    .in("id", parsedIds.data)
    .eq("owner_id", c.companyId);
  if (error) {
    console.error("[operativo] stato", error.message);
    return { ok: false, error: error.message.includes("status") ? "Serve l'aggiornamento del database (SQL 0048)." : SAVE_ERROR };
  }
  return { ok: true };
}

/** Righe dei giorni da riconfermare (i servizi cancellati no). */
export async function getRiconferme(dates: string[]): Promise<{ ok: true; rows: OpsRow[] } | Fail> {
  const c = await ctx();
  const parsed = z.array(date).min(1).max(7).safeParse(dates);
  if (!c || !parsed.success) return { ok: false, error: "Giorni non validi." };
  const { data, error } = await c.supabase
    .from("ops_rows")
    .select(SELECT)
    .eq("owner_id", c.companyId)
    .in("service_date", parsed.data)
    .neq("status", "cancellato")
    .order("service_date")
    .limit(2000);
  if (error) {
    console.error("[operativo] riconferme", error.message);
    return { ok: false, error: error.message.includes("status") ? "Serve l'aggiornamento del database (SQL 0048)." : "Non sono riuscito a leggere i servizi. Riprova." };
  }
  return { ok: true, rows: (data ?? []) as OpsRow[] };
}

// ── Importazione dagli itinerari ────────────────────────────────────────────

/** Crea una riga per ogni attività degli itinerari nel periodo (quelle già importate restano come sono). */
export async function importOpsFromTrips(
  from: string,
  to: string,
  includeUnconfirmed: boolean,
  tripId?: string,
  markConfirmed = false,
): Promise<{ ok: true; rows: OpsRow[]; skipped: number } | Fail> {
  const c = await ctx();
  if (!c || !date.safeParse(from).success || !date.safeParse(to).success || from > to) return { ok: false, error: "Periodo non valido." };
  if (tripId !== undefined && !z.string().uuid().safeParse(tripId).success) return { ok: false, error: "Viaggio non valido." };
  if (nightsBetween(from, to) > (tripId ? 400 : 62)) return { ok: false, error: "Importa al massimo due mesi alla volta." };
  const { supabase, companyId } = c;

  // l'importazione si attiva nelle Impostazioni (serve ai tour operator, non alle agenzie)
  const { data: profile } = await supabase.from("profiles").select("ai_preferences").eq("id", companyId).maybeSingle();
  if ((profile?.ai_preferences as Record<string, string> | null)?.ops_import !== "on")
    return { ok: false, error: "L'importazione dai viaggi è spenta: puoi attivarla in Impostazioni → Operativo day by day." };

  let dayQuery = supabase
    .from("trip_days")
    .select("id, trip_id, day_date, trips!inner(id, code, title, owner_id, itinerary_stage, approval_status, clients(full_name))")
    .eq("trips.owner_id", companyId)
    .gte("day_date", from)
    .lte("day_date", to);
  if (tripId) dayQuery = dayQuery.eq("trip_id", tripId);
  const { data: dayData, error: dayErr } = await dayQuery.limit(5000);
  if (dayErr) {
    console.error("[operativo] import days", dayErr.message);
    return { ok: false, error: "Non sono riuscito a leggere i viaggi. Riprova." };
  }
  const days = ((dayData ?? []) as unknown as ImportDay[]).filter(
    (d) => d.trips && (includeUnconfirmed || tripId || d.trips.itinerary_stage === "finale" || d.trips.approval_status === "approved"),
  );
  if (days.length === 0) return { ok: true, rows: [], skipped: 0 };
  const dayById = new Map(days.map((d) => [d.id, d]));

  const acts: ImportActivity[] = [];
  for (const ids of chunks([...dayById.keys()], 150)) {
    const { data, error } = await supabase
      .from("activities")
      .select("id, trip_day_id, start_time, title, location, activity_type, details")
      .in("trip_day_id", ids)
      .neq("activity_type", "info")
      .order("activity_order");
    if (error) return { ok: false, error: "Non sono riuscito a leggere gli itinerari. Riprova." };
    // il blocco «Programma della giornata» degli itinerari a giornata intera non è un servizio
    acts.push(...((data ?? []) as ImportActivity[]).filter((a) => a.title !== DAY_BLOCK_TITLE));
  }
  if (acts.length === 0) return { ok: true, rows: [], skipped: 0 };

  const already = new Set<string>();
  for (const ids of chunks(acts.map((a) => a.id), 150)) {
    const { data: existing, error: exErr } = await supabase.from("ops_rows").select("activity_id").eq("owner_id", companyId).in("activity_id", ids);
    if (exErr) return { ok: false, error: exErr.code === "42P01" ? NOT_READY : "Non sono riuscito a leggere la scheda. Riprova." };
    for (const r of existing ?? []) if (r.activity_id) already.add(r.activity_id);
  }
  const services = await loadServices(supabase, acts.map((a) => a.id));

  const toInsert = acts
    .filter((a) => !already.has(a.id))
    .map((a) => {
      const day = dayById.get(a.trip_day_id)!;
      const source = sourceFromActivity(a, day, services.get(a.id));
      return {
        owner_id: companyId,
        ...source,
        agent: "",
        responsible: "",
        source,
        trip_id: day.trips!.id,
        activity_id: a.id,
        // viaggio appena segnato «finale»: si presume che i servizi siano confermati
        ...(markConfirmed ? { status: "confermato" as const } : {}),
      };
    });

  const rows: OpsRow[] = [];
  for (const part of chunks(toInsert, 200)) {
    const { data, error } = await supabase.from("ops_rows").insert(part).select(SELECT);
    if (error) {
      console.error("[operativo] import insert", error.message);
      // doppio clic o importazione già in corso: le righe ci sono già
      if (error.code === "23505") continue;
      return { ok: false, error: rows.length ? `Importate ${rows.length} righe, poi c'è stato un errore. Riprova per completare.` : SAVE_ERROR };
    }
    rows.push(...((data ?? []) as OpsRow[]));
  }
  return { ok: true, rows, skipped: already.size };
}

/** Viaggio appena segnato «finale»: se l'agenzia lo ha attivato (Impostazioni → Operativo day by day), i suoi servizi
 *  entrano da soli nella scheda operativa, già «Confermato». Quelli già presenti non si duplicano. Non fa mai fallire
 *  il cambio di stato del viaggio. Restituisce quante righe ha aggiunto (0 se spento o se non c'era nulla). */
export async function autoImportOnFinal(tripId: string): Promise<number> {
  try {
    const c = await ctx();
    if (!c || !z.string().uuid().safeParse(tripId).success) return 0;
    const { supabase, companyId } = c;
    const [{ data: profile }, { data: trip }] = await Promise.all([
      supabase.from("profiles").select("ai_preferences").eq("id", companyId).maybeSingle(),
      supabase.from("trips").select("start_date, end_date").eq("id", tripId).eq("owner_id", companyId).maybeSingle(),
    ]);
    const prefs = (profile?.ai_preferences as Record<string, string> | null) ?? {};
    if (prefs.ops_import !== "on" || prefs.ops_auto === "off") return 0;
    const from = (trip as { start_date?: string | null } | null)?.start_date;
    const to = (trip as { end_date?: string | null } | null)?.end_date ?? from;
    if (!from || !to || from > to) return 0;
    const res = await importOpsFromTrips(from, to, false, tripId, true);
    return res.ok ? res.rows.length : 0;
  } catch (error) {
    console.error("[operativo] importazione automatica", error);
    return 0;
  }
}

/** Quanti servizi (non cancellati) ci sono in ogni giorno del periodo: per l'agenda dell'Operativo. */
export async function opsServiceDays(from: string, to: string): Promise<Record<string, number>> {
  const c = await ctx();
  if (!c || !date.safeParse(from).success || !date.safeParse(to).success || from > to || nightsBetween(from, to) > 62) return {};
  const { data, error } = await c.supabase
    .from("ops_rows")
    .select("service_date, status")
    .eq("owner_id", c.companyId)
    .gte("service_date", from)
    .lte("service_date", to)
    .limit(5000);
  if (error) return {};
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { service_date: string; status: string | null }[]) {
    if (r.status === "cancellato") continue;
    out[r.service_date] = (out[r.service_date] ?? 0) + 1;
  }
  return out;
}
