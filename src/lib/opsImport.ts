// Scheda operativa: dall'attività dell'itinerario ai valori della riga, e controllo delle righe
// importate quando l'itinerario cambia (usato dalla pagina «Operativo» e dall'importazione).
import type { SupabaseClient } from "@supabase/supabase-js";
import { OPS_SOURCE_KEYS, type OpsChanges, type OpsRow, type OpsSource } from "@/lib/opsSheet";

export type ImportDay = {
  id: string;
  trip_id: string;
  day_date: string;
  trips: {
    id: string;
    code: string | null;
    title: string;
    itinerary_stage?: string | null;
    approval_status?: string | null;
    clients: { full_name: string | null } | null;
  } | null;
};
export type ImportActivity = {
  id: string;
  trip_day_id: string;
  start_time: string | null;
  title: string;
  location: string | null;
  activity_type: string;
  details: Record<string, string> | null;
};
export type ImportService = {
  activity_id: string;
  notes: string | null;
  confirmation_number: string | null;
  suppliers: { full_name: string | null; phone: string | null } | null;
};

export const chunks = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export const nightsBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** I valori che l'itinerario dà alla riga (fornitore e contatto dai «Servizi e fornitori» collegati all'attività). */
export function sourceFromActivity(a: ImportActivity, day: ImportDay, s: ImportService | undefined): OpsSource {
  const trip = day.trips!;
  const d = a.details ?? {};
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
    service_date: day.day_date,
    trip_code: trip.code ?? "",
    client: (clean(trip.clients?.full_name) || clean(trip.title)).slice(0, 500),
    supplier: (clean(s?.suppliers?.full_name) || clean(d.fornitore) || clean(d.compagnia)).slice(0, 500),
    supplier_contact: clean(s?.suppliers?.phone).slice(0, 500),
    pax: clean(d.numero_persone).slice(0, 500),
    service: clean(a.title).slice(0, 4000),
    meeting_time: meetingTime,
    meeting_point: (clean(d.punto_incontro) || clean(d.aeroporto_partenza) || clean(d.porto_partenza) || clean(a.location)).slice(0, 500),
    notes: extra.join(" · ").slice(0, 4000),
  };
}

export async function loadServices(supabase: SupabaseClient, activityIds: string[]) {
  const services = new Map<string, ImportService>();
  for (const ids of chunks(activityIds, 150)) {
    const { data } = await supabase
      .from("trip_services")
      .select("activity_id, notes, confirmation_number, suppliers(full_name, phone)")
      .in("activity_id", ids)
      .neq("status", "cancellato");
    for (const s of (data ?? []) as unknown as ImportService[]) if (!services.has(s.activity_id)) services.set(s.activity_id, s);
  }
  return services;
}

type SyncRow = OpsRow & { source: OpsSource | null };

/**
 * Confronta le righe importate con l'itinerario di adesso. I campi che nessuno ha toccato nella scheda
 * si aggiornano da soli; quelli modificati a mano restano come sono e la novità viene solo segnalata.
 * Restituisce le righe aggiornate (senza «source»).
 */
export async function syncImportedRows(supabase: SupabaseClient, rows: SyncRow[]): Promise<OpsRow[]> {
  const linked = rows.filter((r) => r.activity_id);
  const acts = new Map<string, ImportActivity>();
  const days = new Map<string, ImportDay>();
  let services = new Map<string, ImportService>();
  try {
    for (const ids of chunks(linked.map((r) => r.activity_id!), 150)) {
      const { data, error } = await supabase.from("activities").select("id, trip_day_id, start_time, title, location, activity_type, details").in("id", ids);
      if (error) throw error;
      for (const a of (data ?? []) as ImportActivity[]) acts.set(a.id, a);
    }
    for (const ids of chunks([...new Set([...acts.values()].map((a) => a.trip_day_id))], 150)) {
      const { data, error } = await supabase.from("trip_days").select("id, trip_id, day_date, trips(id, code, title, clients(full_name))").in("id", ids);
      if (error) throw error;
      for (const d of (data ?? []) as unknown as ImportDay[]) days.set(d.id, d);
    }
    services = await loadServices(supabase, [...acts.keys()]);
  } catch (e) {
    console.error("[operativo] controllo itinerari", e);
    return rows.map(strip);
  }

  const out: OpsRow[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  for (const row of rows) {
    // attività tolta dall'itinerario (il collegamento si azzera da solo)
    if (!row.activity_id) {
      if (row.source && !row.changes?._removed) {
        const changes: OpsChanges = { ...(row.changes ?? {}), _removed: { from: row.service, to: "", applied: false } };
        updates.push({ id: row.id, patch: { changes, source: null } });
        out.push(strip({ ...row, changes }));
      } else out.push(strip(row));
      continue;
    }
    const a = acts.get(row.activity_id);
    const day = a ? days.get(a.trip_day_id) : undefined;
    if (!a || !day?.trips || !day.day_date) {
      out.push(strip(row));
      continue;
    }
    const fresh = sourceFromActivity(a, day, services.get(a.id));
    if (!row.source) {
      // righe importate prima di questo controllo: si parte da qui
      updates.push({ id: row.id, patch: { source: fresh } });
      out.push(strip(row));
      continue;
    }
    const patch: Record<string, unknown> = {};
    const changes: OpsChanges = { ...(row.changes ?? {}) };
    let changed = false;
    for (const k of OPS_SOURCE_KEYS) {
      const before = row.source[k] ?? "";
      if (fresh[k] === before) continue;
      changed = true;
      if (row[k] === before) {
        patch[k] = fresh[k];
        changes[k] = { from: before, to: fresh[k], applied: true };
      } else if (row[k] !== fresh[k]) {
        changes[k] = { from: row[k], to: fresh[k], applied: false };
      }
    }
    if (!changed) {
      out.push(strip(row));
      continue;
    }
    const next = { ...row, ...patch, changes } as SyncRow;
    updates.push({ id: row.id, patch: { ...patch, changes, source: fresh, updated_at: new Date().toISOString() } });
    out.push(strip(next));
  }

  for (const part of chunks(updates, 20)) {
    await Promise.all(part.map((u) => supabase.from("ops_rows").update(u.patch).eq("id", u.id))).catch((e) => console.error("[operativo] aggiornamento righe", e));
  }
  return out;
}

function strip(r: SyncRow): OpsRow {
  const { source: _s, ...rest } = r;
  void _s;
  return { ...rest, changes: rest.changes ?? {}, status: rest.status ?? "" };
}
