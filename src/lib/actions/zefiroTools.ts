"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadAiRules } from "@/lib/aiRulesServer";
import { reserveAiCall } from "@/lib/aiQuota";
import { activityTypes } from "@/lib/activityTypes";
import { DAY_BLOCK_TITLE, parseMode } from "@/lib/itineraryMode";
import { SuggestionSchema, buildChecklist, describeActivities, suggestForDay, type DescribeInput, type Suggestion } from "@/lib/tripToolsAi";

type Act = {
  id: string;
  trip_day_id: string;
  start_time: string | null;
  activity_type: string;
  title: string;
  description: string | null;
  location: string | null;
  activity_order: number;
};
type DayRow = { id: string; day_date: string | null; title: string | null; activities: Act[] };

const strip = (html: string | null) => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function load(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." } as const;
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).eq("owner_id", user.id).maybeSingle();
  if (!trip) return { error: "Viaggio non trovato." } as const;
  const { data: days } = await supabase
    .from("trip_days")
    .select("id, day_date, day_order, title, activities(id, trip_day_id, start_time, activity_type, title, description, location, activity_order)")
    .eq("trip_id", tripId)
    .order("day_order", { ascending: true });
  return { supabase, user, trip, days: (days ?? []) as unknown as DayRow[] };
}

async function loadStyle(supabase: Awaited<ReturnType<typeof createClient>>, styleId: string | null | undefined) {
  if (!styleId || !/^[0-9a-f-]{36}$/i.test(styleId)) return null;
  const { data } = await supabase.from("prompt_styles").select("prompt_text").eq("id", styleId).maybeSingle();
  return (data?.prompt_text as string | undefined) ?? null;
}

// Riassunto compatto del viaggio, dato in pasto all'AI
function summarize(trip: { title: string; destination: string | null; start_date: string | null; end_date: string | null }, days: DayRow[]) {
  const lines = days.map((d, i) => {
    const acts = [...d.activities]
      .sort((a, b) => a.activity_order - b.activity_order)
      .map((a) => (a.title === DAY_BLOCK_TITLE ? strip(a.description).slice(0, 300) : `${a.start_time ? a.start_time.slice(0, 5) + " " : ""}${a.title} (${a.activity_type})`))
      .join("; ");
    return `Giorno ${i + 1}${d.day_date ? ` (${d.day_date})` : ""}${d.title ? ` — ${d.title}` : ""}: ${acts || "vuoto"}`;
  });
  return `VIAGGIO: ${trip.title}${trip.destination ? ` · ${trip.destination}` : ""}${trip.start_date ? ` · dal ${trip.start_date}` : ""}${trip.end_date ? ` al ${trip.end_date}` : ""} · ${days.length} giorni\n${lines.join("\n")}`;
}

// ── Completa le descrizioni ─────────────────────────────────────────────

export type DescribeProposal = { id: string; day: number; title: string; description: string };

export async function proposeDescriptions(tripId: string, styleId?: string | null): Promise<{ error: string } | { items: DescribeProposal[]; capped: boolean }> {
  const loaded = await load(tripId);
  if ("error" in loaded) return { error: loaded.error as string };
  const { supabase, trip, days } = loaded;
  if (parseMode(trip.itinerary_mode) === "days") return { error: "Nel viaggio per giornata intera il programma è un unico blocco di testo: qui non ci sono descrizioni singole." };

  const missing: (DescribeInput & { order: number })[] = [];
  days.forEach((d, i) =>
    [...d.activities]
      .sort((a, b) => a.activity_order - b.activity_order)
      .forEach((a) => {
        if (strip(a.description).length < 3) missing.push({ id: a.id, day: i + 1, type: a.activity_type, title: a.title, location: a.location, time: a.start_time?.slice(0, 5) ?? null, order: a.activity_order });
      }),
  );
  if (missing.length === 0) return { error: "Tutte le attività hanno già una descrizione." };
  const capped = missing.length > 60;
  const batch = missing.slice(0, 60);

  const quota = await reserveAiCall("itinerary");
  if (!quota.ok) return { error: quota.error };
  const rules = await loadAiRules();
  const styleInstructions = await loadStyle(supabase, styleId);

  try {
    // Blocchi da 30 attività, in parallelo
    const chunks: (typeof batch)[] = [];
    for (let i = 0; i < batch.length; i += 30) chunks.push(batch.slice(i, i + 30));
    const results = await Promise.all(
      chunks.map((chunk) =>
        describeActivities({
          tripTitle: trip.title,
          destination: trip.destination,
          items: chunk.map(({ order: _order, ...rest }) => rest),
          rulesBlock: rules.text,
          styleInstructions,
        }),
      ),
    );
    const byId = new Map(batch.map((m) => [m.id, m]));
    const items: DescribeProposal[] = [];
    for (const r of results.flat()) {
      const m = byId.get(r.id);
      const text = r.description.trim();
      if (m && text) items.push({ id: m.id, day: m.day, title: m.title, description: text.slice(0, 600) });
    }
    if (items.length === 0) return { error: "Non ho trovato nulla di utile da scrivere. Aggiungi qualche dettaglio ai titoli e riprova." };
    return { items, capped };
  } catch (error) {
    console.error("[proposeDescriptions]", (error as Error).message);
    return { error: "Non è stato possibile scrivere le descrizioni. Riprova tra poco." };
  }
}

export async function applyDescriptions(tripId: string, items: { id: string; description: string }[]): Promise<{ ok: true; applied: number } | { error: string }> {
  const parsed = z.array(z.object({ id: z.string().uuid(), description: z.string().min(1).max(1000) })).min(1).max(80).safeParse(items);
  if (!parsed.success) return { error: "I dati non sono validi. Riprova." };
  const loaded = await load(tripId);
  if ("error" in loaded) return { error: loaded.error as string };
  const { supabase, days } = loaded;

  const current = new Map<string, Act>();
  days.forEach((d) => d.activities.forEach((a) => current.set(a.id, a)));
  let applied = 0;
  for (const item of parsed.data) {
    const act = current.get(item.id);
    // Solo attività di questo viaggio che sono ancora senza descrizione
    if (!act || strip(act.description).length >= 3) continue;
    const { error } = await supabase.from("activities").update({ description: item.description }).eq("id", act.id);
    if (!error) applied++;
  }
  revalidatePath(`/dashboard/trips/${tripId}`);
  return applied > 0 ? { ok: true, applied } : { error: "Non è stato possibile salvare le descrizioni." };
}

// ── Checklist ───────────────────────────────────────────────────────────

export async function proposeChecklist(tripId: string): Promise<{ error: string } | { items: string[] }> {
  const loaded = await load(tripId);
  if ("error" in loaded) return { error: loaded.error as string };
  const { supabase, trip, days } = loaded;
  if (days.every((d) => d.activities.length === 0)) return { error: "L'itinerario è ancora vuoto: scrivi prima qualche giorno, poi preparo la checklist." };

  const { data: existingRows } = await supabase.from("trip_checklist_items").select("label").eq("trip_id", tripId);
  const existing = (existingRows ?? []).map((r) => String(r.label));

  const quota = await reserveAiCall("itinerary");
  if (!quota.ok) return { error: quota.error };
  const rules = await loadAiRules();
  try {
    const items = await buildChecklist({ summary: summarize(trip, days), existing, rulesBlock: rules.text });
    const seen = new Set(existing.map((e) => e.toLowerCase().trim()));
    const fresh = items.map((i) => i.trim()).filter((i) => i && !seen.has(i.toLowerCase()));
    if (fresh.length === 0) return { error: "La checklist è già completa: non ho altro da aggiungere." };
    return { items: fresh };
  } catch (error) {
    console.error("[proposeChecklist]", (error as Error).message);
    return { error: "Non è stato possibile preparare la checklist. Riprova tra poco." };
  }
}

export async function applyChecklist(tripId: string, labels: string[]): Promise<{ ok: true; added: number } | { error: string }> {
  const parsed = z.array(z.string().trim().min(1).max(200)).min(1).max(30).safeParse(labels);
  if (!parsed.success) return { error: "I dati non sono validi. Riprova." };
  const loaded = await load(tripId);
  if ("error" in loaded) return { error: loaded.error as string };
  const { supabase } = loaded;

  const { data: existing } = await supabase.from("trip_checklist_items").select("label, item_order").eq("trip_id", tripId);
  const seen = new Set((existing ?? []).map((r) => String(r.label).toLowerCase().trim()));
  let order = Math.max(-1, ...(existing ?? []).map((r) => Number(r.item_order) || 0)) + 1;
  const rows = parsed.data.filter((l) => !seen.has(l.toLowerCase())).map((label) => ({ trip_id: tripId, label, item_order: order++ }));
  if (rows.length === 0) return { error: "Queste voci sono già nella checklist." };
  const { error } = await supabase.from("trip_checklist_items").insert(rows);
  if (error) return { error: "Non è stato possibile aggiungere le voci." };
  revalidatePath(`/dashboard/trips/${tripId}`);
  return { ok: true, added: rows.length };
}

// ── Suggerisci attività ─────────────────────────────────────────────────

export async function proposeSuggestions(tripId: string, dayId: string, preference: string, styleId?: string | null): Promise<{ error: string } | { suggestions: Suggestion[] }> {
  const loaded = await load(tripId);
  if ("error" in loaded) return { error: loaded.error as string };
  const { supabase, trip, days } = loaded;
  const index = days.findIndex((d) => d.id === dayId);
  if (index < 0) return { error: "Giorno non trovato." };
  const day = days[index];

  const quota = await reserveAiCall("itinerary");
  if (!quota.ok) return { error: quota.error };
  const rules = await loadAiRules();
  const styleInstructions = await loadStyle(supabase, styleId);
  const dayContent = [...day.activities]
    .sort((a, b) => a.activity_order - b.activity_order)
    .map((a) => (a.title === DAY_BLOCK_TITLE ? strip(a.description) : `${a.start_time ? a.start_time.slice(0, 5) + " " : ""}${a.title}${a.location ? ` (${a.location})` : ""}`))
    .join("\n");
  try {
    const suggestions = await suggestForDay({
      summary: summarize(trip, days),
      dayN: index + 1,
      dayContent,
      preference: String(preference ?? "").trim().slice(0, 500),
      rulesBlock: rules.text,
      styleInstructions,
    });
    if (suggestions.length === 0) return { error: "Non ho idee da proporre. Prova a dare una preferenza." };
    return { suggestions };
  } catch (error) {
    console.error("[proposeSuggestions]", (error as Error).message);
    return { error: "Non è stato possibile preparare i suggerimenti. Riprova tra poco." };
  }
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function applySuggestions(tripId: string, dayId: string, suggestions: Suggestion[]): Promise<{ ok: true; added: number } | { error: string }> {
  const parsed = z.array(SuggestionSchema).min(1).max(5).safeParse(suggestions);
  if (!parsed.success) return { error: "I dati non sono validi. Riprova." };
  const loaded = await load(tripId);
  if ("error" in loaded) return { error: loaded.error as string };
  const { supabase, trip, days } = loaded;
  const day = days.find((d) => d.id === dayId);
  if (!day) return { error: "Giorno non trovato." };

  const time = (v: string | null) => (v && /^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim() : null);

  if (parseMode(trip.itinerary_mode) === "days") {
    // Giornata intera: le idee diventano righe dell'elenco del blocco
    const items = parsed.data
      .map((s) => `<li>${s.start_time && time(s.start_time) ? `<strong>${esc(time(s.start_time)!)}</strong> ` : ""}<strong>${esc(s.title)}</strong>${s.location ? ` <em>(${esc(s.location)})</em>` : ""} — ${esc(s.description)}</li>`)
      .join("");
    const first = [...day.activities].sort((a, b) => a.activity_order - b.activity_order)[0];
    if (first) {
      const html = first.description ?? "";
      const next = /<\/ul>\s*$/i.test(html) ? html.replace(/<\/ul>\s*$/i, `${items}</ul>`) : `${html}<ul>${items}</ul>`;
      const { error } = await supabase.from("activities").update({ description: next }).eq("id", first.id);
      if (error) return { error: "Non è stato possibile aggiungere le attività." };
    } else {
      const { error } = await supabase.from("activities").insert({ trip_day_id: dayId, title: DAY_BLOCK_TITLE, activity_type: "attivita", description: `<ul>${items}</ul>`, details: {}, activity_order: 0 });
      if (error) return { error: "Non è stato possibile aggiungere le attività." };
    }
  } else {
    let order = Math.max(-1, ...day.activities.map((a) => a.activity_order)) + 1;
    const rows = parsed.data
      .filter((s) => s.activity_type in activityTypes)
      .map((s) => ({
        trip_day_id: dayId,
        title: s.title.slice(0, 200),
        activity_type: s.activity_type,
        start_time: time(s.start_time),
        description: s.description.slice(0, 1000),
        location: s.location?.slice(0, 200) ?? null,
        details: {},
        activity_order: order++,
      }));
    const { error } = await supabase.from("activities").insert(rows);
    if (error) return { error: "Non è stato possibile aggiungere le attività." };
  }
  revalidatePath(`/dashboard/trips/${tripId}`);
  return { ok: true, added: parsed.data.length };
}
