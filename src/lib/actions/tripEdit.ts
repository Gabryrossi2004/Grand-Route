"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadAiRules } from "@/lib/aiRulesServer";
import { MAX_DRAFT_CHARS, reserveAiCall } from "@/lib/aiQuota";
import { EditOpSchema, buildSnapshot, proposeEdits, type EditOp, type EditSnapshot } from "@/lib/tripEditAi";
import { activityTypes } from "@/lib/activityTypes";
import { companyIdOf } from "@/lib/team";

export type EditChange = { id: number; text: string; reason: string; op: EditOp };
export type ProposeResult = { error: string } | { questions: string[]; summary: string } | { summary: string; changes: EditChange[] };

type ActivityRow = {
  id: string;
  trip_day_id: string;
  start_time: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  location: string | null;
  activity_order: number;
};

async function loadTrip(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." } as const;
  const companyId = await companyIdOf(user.id);
  const { data: trip } = await supabase.from("trips").select("id, itinerary_mode").eq("id", tripId).eq("owner_id", companyId).maybeSingle();
  if (!trip) return { error: "Viaggio non trovato." } as const;
  const { data: days } = await supabase
    .from("trip_days")
    .select("id, day_date, day_order, title, activities(id, trip_day_id, start_time, activity_type, title, description, location, activity_order)")
    .eq("trip_id", tripId)
    .order("day_order", { ascending: true });
  return { supabase, daysMode: (trip as { itinerary_mode?: string }).itinerary_mode === "days", days: (days ?? []) as unknown as { id: string; day_date: string | null; title: string | null; activities: ActivityRow[] }[] };
}

const typeLabel = (t: string | null) => (t && t in activityTypes ? activityTypes[t as keyof typeof activityTypes].label.toLowerCase() : "attività");

// Controlla le operazioni proposte rispetto all'itinerario vero e le descrive in italiano.
function describe(snapshot: EditSnapshot, ops: EditOp[]): EditChange[] {
  const dayOfActivity = new Map<string, { n: number; title: string; time: string | null }>();
  const dayById = new Map<string, number>();
  snapshot.days.forEach((d) => {
    dayById.set(d.id, d.n);
    d.activities.forEach((a) => dayOfActivity.set(a.id, { n: d.n, title: a.title, time: a.time }));
  });

  const out: EditChange[] = [];
  ops.forEach((op, i) => {
    const push = (text: string) => out.push({ id: i, text, reason: op.reason, op });
    const act = op.activity_id ? dayOfActivity.get(op.activity_id) : undefined;
    switch (op.op) {
      case "update_activity": {
        if (!act) return;
        const parts: string[] = [];
        if (op.title) parts.push(`titolo «${op.title}»`);
        if (op.start_time !== null) parts.push(op.start_time ? `orario ${op.start_time}` : "senza orario");
        if (op.description) parts.push("nuova descrizione");
        if (op.location) parts.push(`luogo ${op.location}`);
        if (op.activity_type) parts.push(`tipo ${typeLabel(op.activity_type)}`);
        if (parts.length === 0) return;
        push(`Giorno ${act.n} · «${act.title}»: ${parts.join(", ")}`);
        return;
      }
      case "add_activity": {
        const n = op.day_id ? dayById.get(op.day_id) : undefined;
        if (!n || !op.title || !op.activity_type) return;
        push(`Giorno ${n} · aggiungi ${typeLabel(op.activity_type)} «${op.title}»${op.start_time ? ` alle ${op.start_time}` : ""}`);
        return;
      }
      case "delete_activity": {
        if (!act) return;
        push(`Giorno ${act.n} · elimina «${act.title}»`);
        return;
      }
      case "move_activity": {
        const n = op.day_id ? dayById.get(op.day_id) : undefined;
        if (!act || !n) return;
        push(`«${act.title}»: dal giorno ${act.n} al giorno ${n}${op.start_time ? `, alle ${op.start_time}` : ""}`);
        return;
      }
      case "update_day_title": {
        const n = op.day_id ? dayById.get(op.day_id) : undefined;
        if (!n || !op.title) return;
        push(`Giorno ${n} · nuovo titolo «${op.title}»`);
        return;
      }
    }
  });
  return out;
}

export async function proposeTripEdits(tripId: string, instruction: string): Promise<ProposeResult> {
  const text = String(instruction ?? "").trim();
  if (!text) return { error: "Scrivi cosa vuoi cambiare." };
  if (text.length > 4000) return { error: "La richiesta è troppo lunga (massimo 4000 caratteri)." };

  const loaded = await loadTrip(tripId);
  if ("error" in loaded) return { error: loaded.error as string };
  if (loaded.days.every((d) => d.activities.length === 0)) return { error: "L'itinerario è ancora vuoto: usa prima «Genera un itinerario»." };

  const quota = await reserveAiCall("itinerary");
  if (!quota.ok) return { error: quota.error };

  const snapshot = buildSnapshot(loaded.days, { raw: loaded.daysMode });
  if (JSON.stringify(snapshot).length > MAX_DRAFT_CHARS) return { error: "L'itinerario è troppo lungo per questa funzione." };
  const rules = await loadAiRules();
  try {
    const result = await proposeEdits({ snapshot, instruction: text, rulesBlock: rules.text, daysMode: loaded.daysMode });
    if (result.questions.length > 0 && result.operations.length === 0) return { questions: result.questions, summary: result.summary };
    const changes = describe(snapshot, result.operations);
    if (changes.length === 0) return { error: result.summary ? `Nessuna modifica possibile: ${result.summary}` : "Non ho trovato modifiche da proporre. Prova a descriverle meglio." };
    return { summary: result.summary, changes };
  } catch (error) {
    console.error("[proposeTripEdits]", (error as Error).message);
    return { error: "Non è stato possibile preparare le modifiche. Riprova tra poco." };
  }
}

const ApplyInput = z.object({ tripId: z.string().uuid(), ops: z.array(EditOpSchema).min(1).max(30) });

// Applica le modifiche scelte. Ogni operazione è ricontrollata: gli id devono appartenere a questo viaggio.
export async function applyTripEdits(input: { tripId: string; ops: EditOp[] }): Promise<{ ok: true; applied: number } | { error: string }> {
  const parsed = ApplyInput.safeParse(input);
  if (!parsed.success) return { error: "Le modifiche non sono valide. Riprova." };
  const loaded = await loadTrip(parsed.data.tripId);
  if ("error" in loaded) return { error: loaded.error as string };
  const { supabase, days } = loaded;

  const dayIds = new Set(days.map((d) => d.id));
  const acts = new Map<string, ActivityRow>();
  days.forEach((d) => d.activities.forEach((a) => acts.set(a.id, a)));
  const nextOrder = (dayId: string) => Math.max(-1, ...[...acts.values()].filter((a) => a.trip_day_id === dayId).map((a) => a.activity_order)) + 1;
  const time = (value: string | null) => (value && /^\d{1,2}:\d{2}$/.test(value.trim()) ? value.trim() : null);

  let applied = 0;
  for (const op of parsed.data.ops) {
    const act = op.activity_id ? acts.get(op.activity_id) : undefined;
    try {
      if (op.op === "update_activity" && act) {
        const patch: Record<string, unknown> = {};
        if (op.title) patch.title = op.title.slice(0, 200);
        if (op.start_time !== null) patch.start_time = op.start_time === "" ? null : time(op.start_time);
        if (op.description) patch.description = op.description.slice(0, 20000);
        if (op.location) patch.location = op.location.slice(0, 200);
        if (op.activity_type && op.activity_type in activityTypes) patch.activity_type = op.activity_type;
        if (Object.keys(patch).length === 0) continue;
        const { error } = await supabase.from("activities").update(patch).eq("id", act.id);
        if (error) throw error;
        Object.assign(act, patch);
      } else if (op.op === "add_activity" && op.day_id && dayIds.has(op.day_id) && op.title && op.activity_type && op.activity_type in activityTypes) {
        const after = op.after_activity_id ? acts.get(op.after_activity_id) : undefined;
        let order = nextOrder(op.day_id);
        if (after && after.trip_day_id === op.day_id) {
          order = after.activity_order + 1;
          const later = [...acts.values()].filter((a) => a.trip_day_id === op.day_id && a.activity_order >= order);
          for (const a of later) {
            await supabase.from("activities").update({ activity_order: a.activity_order + 1 }).eq("id", a.id);
            a.activity_order += 1;
          }
        }
        const { data, error } = await supabase
          .from("activities")
          .insert({
            trip_day_id: op.day_id,
            title: op.title.slice(0, 200),
            activity_type: op.activity_type,
            start_time: time(op.start_time),
            description: op.description?.slice(0, 3000) || null,
            location: op.location?.slice(0, 200) || null,
            details: {},
            activity_order: order,
          })
          .select("id, trip_day_id, start_time, activity_type, title, description, location, activity_order")
          .single();
        if (error) throw error;
        if (data) acts.set(data.id as string, data as ActivityRow);
      } else if (op.op === "delete_activity" && act) {
        const { error } = await supabase.from("activities").delete().eq("id", act.id);
        if (error) throw error;
        acts.delete(act.id);
      } else if (op.op === "move_activity" && act && op.day_id && dayIds.has(op.day_id)) {
        const patch: Record<string, unknown> = { trip_day_id: op.day_id, activity_order: nextOrder(op.day_id) };
        if (op.start_time !== null) patch.start_time = op.start_time === "" ? null : time(op.start_time);
        const { error } = await supabase.from("activities").update(patch).eq("id", act.id);
        if (error) throw error;
        Object.assign(act, patch);
      } else if (op.op === "update_day_title" && op.day_id && dayIds.has(op.day_id) && op.title) {
        const { error } = await supabase.from("trip_days").update({ title: op.title.slice(0, 200) }).eq("id", op.day_id);
        if (error) throw error;
      } else {
        continue;
      }
      applied++;
    } catch (error) {
      console.error("[applyTripEdits]", op.op, (error as Error).message);
    }
  }

  revalidatePath(`/dashboard/trips/${parsed.data.tripId}`);
  if (applied === 0) return { error: "Non è stato possibile applicare le modifiche." };
  return { ok: true, applied };
}
