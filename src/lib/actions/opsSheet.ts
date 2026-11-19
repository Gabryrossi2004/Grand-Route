"use server";

import { z } from "zod";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { OPS_COLORS, OPS_TEXT_KEYS, type OpsRow } from "@/lib/opsSheet";
import { DAY_BLOCK_TITLE } from "@/lib/itineraryMode";

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

const patchSchema = z
  .object({ service_date: date, row_color: color, cell_colors: cellColors, trip_id: z.string().uuid().nullable(), ...textFields })
  .partial()
  .strict();

const rowSchema = z
  .object({
    id: z.string().uuid(),
    service_date: date,
    row_color: color.optional(),
    cell_colors: cellColors.optional(),
    trip_id: z.string().uuid().nullable().optional(),
    activity_id: z.string().uuid().nullable().optional(),
    ...Object.fromEntries(OPS_TEXT_KEYS.map((k) => [k, textFields[k].optional()])),
  })
  .strict();

const SELECT = "id, service_date, trip_code, client, agent, supplier, supplier_contact, pax, service, meeting_time, meeting_point, notes, responsible, row_color, cell_colors, trip_id, activity_id, created_at";

async function ctx() {
  const user = await getCachedUser();
  if (!user) return null;
  return { user, supabase: await createClient() };
}

export async function createOpsRow(input: unknown): Promise<{ ok: true; row: OpsRow } | Fail> {
  const parsed = rowSchema.safeParse(input);
  const c = await ctx();
  if (!c || !parsed.success) return { ok: false, error: "Dati non validi." };
  const { data, error } = await c.supabase
    .from("ops_rows")
    .insert({ ...parsed.data, owner_id: c.user.id })
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
    .eq("owner_id", c.user.id);
  if (error) {
    console.error("[operativo] update", error.message);
    return { ok: false, error: SAVE_ERROR };
  }
  return { ok: true };
}

export async function deleteOpsRow(id: string): Promise<{ ok: true } | Fail> {
  const c = await ctx();
  if (!c || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Dati non validi." };
  const { error } = await c.supabase.from("ops_rows").delete().eq("id", id).eq("owner_id", c.user.id);
  if (error) {
    console.error("[operativo] delete", error.message);
    return { ok: false, error: "Non sono riuscito a eliminare la riga. Riprova." };
  }
  return { ok: true };
}

// ── Importazione dagli itinerari ────────────────────────────────────────────

type DayRow = {
  id: string;
  trip_id: string;
  day_date: string;
  trips: { id: string; code: string | null; title: string; owner_id: string; itinerary_stage: string | null; approval_status: string | null; clients: { full_name: string | null } | null } | null;
};
type ActRow = {
  id: string;
  trip_day_id: string;
  start_time: string | null;
  title: string;
  location: string | null;
  activity_type: string;
  details: Record<string, string> | null;
};
type ServiceRow = {
  activity_id: string;
  notes: string | null;
  confirmation_number: string | null;
  suppliers: { full_name: string | null; phone: string | null } | null;
};

const chunks = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const nightsBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** Crea una riga per ogni attività degli itinerari nel periodo (quelle già importate restano come sono). */
export async function importOpsFromTrips(
  from: string,
  to: string,
  includeUnconfirmed: boolean,
  tripId?: string,
): Promise<{ ok: true; rows: OpsRow[]; skipped: number } | Fail> {
  const c = await ctx();
  if (!c || !date.safeParse(from).success || !date.safeParse(to).success || from > to) return { ok: false, error: "Periodo non valido." };
  if (tripId !== undefined && !z.string().uuid().safeParse(tripId).success) return { ok: false, error: "Viaggio non valido." };
  if (nightsBetween(from, to) > (tripId ? 400 : 62)) return { ok: false, error: "Importa al massimo due mesi alla volta." };
  const { supabase, user } = c;

  // l'importazione si attiva nelle Impostazioni (serve ai tour operator, non alle agenzie)
  const { data: profile } = await supabase.from("profiles").select("ai_preferences").eq("id", user.id).maybeSingle();
  if ((profile?.ai_preferences as Record<string, string> | null)?.ops_import !== "on")
    return { ok: false, error: "L'importazione dai viaggi è spenta: puoi attivarla in Impostazioni → Operativo day by day." };

  let dayQuery = supabase
    .from("trip_days")
    .select("id, trip_id, day_date, trips!inner(id, code, title, owner_id, itinerary_stage, approval_status, clients(full_name))")
    .eq("trips.owner_id", user.id)
    .gte("day_date", from)
    .lte("day_date", to);
  if (tripId) dayQuery = dayQuery.eq("trip_id", tripId);
  const { data: dayData, error: dayErr } = await dayQuery.limit(5000);
  if (dayErr) {
    console.error("[operativo] import days", dayErr.message);
    return { ok: false, error: "Non sono riuscito a leggere i viaggi. Riprova." };
  }
  const days = ((dayData ?? []) as unknown as DayRow[]).filter(
    (d) => d.trips && (includeUnconfirmed || tripId || d.trips.itinerary_stage === "finale" || d.trips.approval_status === "approved"),
  );
  if (days.length === 0) return { ok: true, rows: [], skipped: 0 };
  const dayById = new Map(days.map((d) => [d.id, d]));

  const acts: ActRow[] = [];
  for (const ids of chunks([...dayById.keys()], 150)) {
    const { data, error } = await supabase
      .from("activities")
      .select("id, trip_day_id, start_time, title, location, activity_type, details")
      .in("trip_day_id", ids)
      .neq("activity_type", "info")
      .order("activity_order");
    if (error) return { ok: false, error: "Non sono riuscito a leggere gli itinerari. Riprova." };
    // il blocco «Programma della giornata» degli itinerari a giornata intera non è un servizio
    acts.push(...((data ?? []) as ActRow[]).filter((a) => a.title !== DAY_BLOCK_TITLE));
  }
  if (acts.length === 0) return { ok: true, rows: [], skipped: 0 };

  const already = new Set<string>();
  const services = new Map<string, ServiceRow>();
  for (const ids of chunks(acts.map((a) => a.id), 150)) {
    const [{ data: existing, error: exErr }, { data: svc }] = await Promise.all([
      supabase.from("ops_rows").select("activity_id").eq("owner_id", user.id).in("activity_id", ids),
      supabase.from("trip_services").select("activity_id, notes, confirmation_number, suppliers(full_name, phone)").in("activity_id", ids).neq("status", "cancellato"),
    ]);
    if (exErr) return { ok: false, error: exErr.code === "42P01" ? NOT_READY : "Non sono riuscito a leggere la scheda. Riprova." };
    for (const r of existing ?? []) if (r.activity_id) already.add(r.activity_id);
    for (const s of (svc ?? []) as unknown as ServiceRow[]) if (!services.has(s.activity_id)) services.set(s.activity_id, s);
  }

  const toInsert = acts
    .filter((a) => !already.has(a.id))
    .map((a) => {
      const day = dayById.get(a.trip_day_id)!;
      const trip = day.trips!;
      const d = a.details ?? {};
      const s = services.get(a.id);
      let meetingTime = a.start_time ? a.start_time.slice(0, 5) : "";
      if (a.activity_type === "alloggio" && /^\d{4}-\d{2}-\d{2}$/.test(clean(d.data_check_out))) {
        const n = nightsBetween(day.day_date, d.data_check_out);
        if (n > 0) meetingTime = n === 1 ? "1 notte" : `${n} notti`;
      }
      const confirmation = clean(s?.confirmation_number) || clean(d.pnr) || clean(d.numero_conferma);
      const extra = [
        a.activity_type === "volo" && clean(d.numero_volo) ? `Volo ${clean(d.numero_volo)}${clean(d.orario_arrivo) ? `, arrivo ${clean(d.orario_arrivo)}` : ""}` : "",
        a.activity_type === "treno" && clean(d.numero_treno) ? `Treno ${clean(d.numero_treno)}${clean(d.orario_arrivo) ? `, arrivo ${clean(d.orario_arrivo)}` : ""}` : "",
        a.activity_type === "alloggio" ? [clean(d.tipo_camera), clean(d.trattamento)].filter(Boolean).join(" in ") : "",
        confirmation ? `Conferma ${confirmation}` : "",
        clean(d.note_prenotazione),
        clean(s?.notes),
      ].filter(Boolean);
      return {
        owner_id: user.id,
        service_date: day.day_date,
        trip_code: trip.code ?? "",
        client: (clean(trip.clients?.full_name) || clean(trip.title)).slice(0, 500),
        agent: "",
        supplier: (clean(s?.suppliers?.full_name) || clean(d.fornitore) || clean(d.compagnia)).slice(0, 500),
        supplier_contact: clean(s?.suppliers?.phone).slice(0, 500),
        pax: clean(d.numero_persone).slice(0, 500),
        service: clean(a.title).slice(0, 4000),
        meeting_time: meetingTime,
        meeting_point: (clean(d.punto_incontro) || clean(d.aeroporto_partenza) || clean(d.porto_partenza) || clean(a.location)).slice(0, 500),
        notes: extra.join(" · ").slice(0, 4000),
        responsible: "",
        trip_id: trip.id,
        activity_id: a.id,
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


