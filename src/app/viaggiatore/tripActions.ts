"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCachedUser } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const NOT_READY = "Questa funzione richiede l'aggiornamento del database (migrazione 0059).";

type Db = Awaited<ReturnType<typeof createClient>>;

// Il viaggio deve essere dell'utente collegato (le regole del database lo controllano comunque)
async function ownedTrip(tripId: string): Promise<{ db: Db; userId: string } | null> {
  if (!z.string().uuid().safeParse(tripId).success) return null;
  const user = await getCachedUser();
  if (!user) return null;
  const db = await createClient();
  const { data } = await db.from("trips").select("id").eq("id", tripId).eq("owner_id", user.id).maybeSingle();
  return data ? { db, userId: user.id } : null;
}

const missing = (error: { code?: string } | null) => error?.code === "42P01" || error?.code === "PGRST205";
const fail = (error: { code?: string } | null, text: string): Result => ({ ok: false, error: missing(error) ? NOT_READY : text });
const refresh = (tripId: string) => {
  revalidatePath(`/viaggiatore/viaggi/${tripId}/valigia`);
  revalidatePath(`/viaggiatore/viaggi/${tripId}/spese`);
};

// ── Valigia ──────────────────────────────────────────────────────────────────
const ItemsInput = z.array(z.object({ text: z.string().trim().min(1).max(120), category: z.string().trim().min(1).max(40) })).min(1).max(80);

export async function addPackingItems(tripId: string, items: { text: string; category: string }[]): Promise<Result> {
  const parsed = ItemsInput.safeParse(items);
  const own = await ownedTrip(tripId);
  if (!parsed.success || !own) return { ok: false, error: "Dati non validi." };
  const { data: existing, error: readError } = await own.db.from("trip_packing_items").select("text, item_order").eq("trip_id", tripId);
  if (readError) return fail(readError, "Non sono riuscito a leggere la lista.");
  const have = new Set((existing ?? []).map((r) => String(r.text).toLowerCase()));
  let order = Math.max(-1, ...(existing ?? []).map((r) => Number(r.item_order) || 0)) + 1;
  const rows = parsed.data
    .filter((it) => !have.has(it.text.toLowerCase()))
    .map((it) => ({ trip_id: tripId, text: it.text, category: it.category, item_order: order++ }));
  if (rows.length === 0) return { ok: true };
  if ((existing?.length ?? 0) + rows.length > 300) return { ok: false, error: "La lista è già molto lunga: togli qualcosa prima." };
  const { error } = await own.db.from("trip_packing_items").insert(rows);
  if (error) return fail(error, "Non sono riuscito a salvare.");
  refresh(tripId);
  return { ok: true };
}

export async function togglePackingItem(tripId: string, id: string, done: boolean): Promise<Result> {
  const own = await ownedTrip(tripId);
  if (!own || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Dati non validi." };
  const { error } = await own.db.from("trip_packing_items").update({ done }).eq("id", id).eq("trip_id", tripId);
  return error ? fail(error, "Non sono riuscito a salvare.") : { ok: true };
}

export async function deletePackingItem(tripId: string, id: string): Promise<Result> {
  const own = await ownedTrip(tripId);
  if (!own || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Dati non validi." };
  const { error } = await own.db.from("trip_packing_items").delete().eq("id", id).eq("trip_id", tripId);
  if (error) return fail(error, "Non sono riuscito a eliminare.");
  refresh(tripId);
  return { ok: true };
}

export async function resetPackingChecks(tripId: string): Promise<Result> {
  const own = await ownedTrip(tripId);
  if (!own) return { ok: false, error: "Dati non validi." };
  const { error } = await own.db.from("trip_packing_items").update({ done: false }).eq("trip_id", tripId);
  if (error) return fail(error, "Non sono riuscito a salvare.");
  refresh(tripId);
  return { ok: true };
}

// ── Persone e spese ──────────────────────────────────────────────────────────
export async function addTripPerson(tripId: string, name: string): Promise<Result> {
  const parsed = z.string().trim().min(1).max(40).safeParse(name);
  const own = await ownedTrip(tripId);
  if (!parsed.success || !own) return { ok: false, error: "Scrivi un nome (massimo 40 lettere)." };
  const { count } = await own.db.from("trip_people").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
  if ((count ?? 0) >= 20) return { ok: false, error: "Massimo 20 persone per viaggio." };
  const { error } = await own.db.from("trip_people").insert({ trip_id: tripId, name: parsed.data });
  if (error) return error.code === "23505" ? { ok: false, error: "C'è già una persona con questo nome." } : fail(error, "Non sono riuscito a salvare.");
  refresh(tripId);
  return { ok: true };
}

export async function removeTripPerson(tripId: string, personId: string): Promise<Result> {
  const own = await ownedTrip(tripId);
  if (!own || !z.string().uuid().safeParse(personId).success) return { ok: false, error: "Dati non validi." };
  const { data: expenses } = await own.db.from("trip_expenses").select("paid_by, shared_with").eq("trip_id", tripId);
  const used = (expenses ?? []).some((e) => e.paid_by === personId || ((e.shared_with as string[] | null) ?? []).includes(personId));
  if (used) return { ok: false, error: "Questa persona compare in alcune spese: eliminale prima." };
  const { error } = await own.db.from("trip_people").delete().eq("id", personId).eq("trip_id", tripId);
  if (error) return fail(error, "Non sono riuscito a eliminare.");
  refresh(tripId);
  return { ok: true };
}

const ExpenseInput = z.object({
  description: z.string().trim().min(1).max(120),
  amount: z.number().positive().max(1_000_000),
  category: z.string().trim().min(1).max(40),
  paidBy: z.string().uuid(),
  sharedWith: z.array(z.string().uuid()).min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function addTripExpense(tripId: string, input: z.input<typeof ExpenseInput>): Promise<Result> {
  const parsed = ExpenseInput.safeParse(input);
  const own = await ownedTrip(tripId);
  if (!parsed.success || !own) return { ok: false, error: "Controlla descrizione, importo e persone." };
  const { description, amount, category, paidBy, sharedWith, date } = parsed.data;
  // Le persone devono essere di questo viaggio
  const { data: people } = await own.db.from("trip_people").select("id").eq("trip_id", tripId);
  const ids = new Set((people ?? []).map((p) => p.id as string));
  if (!ids.has(paidBy) || sharedWith.some((id) => !ids.has(id))) return { ok: false, error: "Persone non valide." };
  const { error } = await own.db.from("trip_expenses").insert({
    trip_id: tripId,
    description,
    amount: Math.round(amount * 100) / 100,
    category,
    paid_by: paidBy,
    shared_with: [...new Set(sharedWith)],
    expense_date: date,
  });
  if (error) return fail(error, "Non sono riuscito a salvare la spesa.");
  refresh(tripId);
  return { ok: true };
}

export async function deleteTripExpense(tripId: string, id: string): Promise<Result> {
  const own = await ownedTrip(tripId);
  if (!own || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Dati non validi." };
  const { error } = await own.db.from("trip_expenses").delete().eq("id", id).eq("trip_id", tripId);
  if (error) return fail(error, "Non sono riuscito a eliminare.");
  refresh(tripId);
  return { ok: true };
}

export async function setTripBudget(tripId: string, amount: number | null): Promise<Result> {
  const parsed = z.number().min(0).max(10_000_000).nullable().safeParse(amount);
  const own = await ownedTrip(tripId);
  if (!parsed.success || !own) return { ok: false, error: "Importo non valido." };
  const { error } = await own.db.from("trips").update({ budget_eur: parsed.data }).eq("id", tripId).eq("owner_id", own.userId);
  if (error) return fail(error, "Non sono riuscito a salvare il budget.");
  refresh(tripId);
  return { ok: true };
}
