"use server";

import { z } from "zod";
import { createClient, getCachedUser } from "@/lib/supabase/server";

// Diario di viaggio: note private del cliente per paese (e luogo), con data.

export type JournalEntry = { id: string; place: string | null; entryDate: string; body: string; tripId: string | null };
export type JournalResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const NOT_READY = "Il diario non è ancora attivo. Riprova tra poco.";
const countrySchema = z.string().trim().min(2).max(80);

export async function listJournal(country: string): Promise<JournalResult<{ entries: JournalEntry[] }>> {
  const parsed = countrySchema.safeParse(country);
  const user = await getCachedUser();
  if (!parsed.success || !user) return { ok: false, error: "Accesso non valido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_journal")
    .select("id, place, entry_date, body, trip_id")
    .eq("user_id", user.id)
    .eq("country", parsed.data)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    console.error("[clientJournal] list", error.message);
    return { ok: false, error: NOT_READY };
  }
  const entries = ((data ?? []) as { id: string; place: string | null; entry_date: string; body: string; trip_id: string | null }[]).map((r) => ({
    id: r.id,
    place: r.place,
    entryDate: r.entry_date,
    body: r.body,
    tripId: r.trip_id,
  }));
  return { ok: true, entries };
}

// Quante note ha il cliente per ogni paese (per mostrarlo sul mappamondo)
export async function countJournalByCountry(): Promise<Record<string, number>> {
  const user = await getCachedUser();
  if (!user) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_journal").select("country").eq("user_id", user.id).limit(3000);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { country: string }[]) counts[row.country] = (counts[row.country] ?? 0) + 1;
  return counts;
}

const addSchema = z.object({
  country: countrySchema,
  place: z.string().trim().max(80).nullable(),
  tripId: z.string().uuid().nullable(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z.string().trim().min(1, "Scrivi qualcosa prima di salvare.").max(4000, "La nota è troppo lunga (massimo 4000 caratteri)."),
});

export async function addJournalEntry(input: z.input<typeof addSchema>): Promise<JournalResult<{ id: string }>> {
  const parsed = addSchema.safeParse(input);
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Accesso non valido." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const { country, place, tripId, entryDate, body } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_journal")
    .insert({ user_id: user.id, country, place: place || null, trip_id: tripId, entry_date: entryDate, body })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[clientJournal] add", error?.message);
    return { ok: false, error: error?.message?.includes("numero massimo") ? error.message : NOT_READY };
  }
  return { ok: true, id: data.id as string };
}

export async function deleteJournalEntry(id: string): Promise<JournalResult> {
  const user = await getCachedUser();
  if (!user || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Accesso non valido." };
  const supabase = await createClient();
  const { error } = await supabase.from("client_journal").delete().eq("id", id).eq("user_id", user.id);
  return error ? { ok: false, error: "Non sono riuscito a eliminare la nota." } : { ok: true };
}
