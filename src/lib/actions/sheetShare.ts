"use server";

import { randomBytes } from "node:crypto";
import { createClient, getCachedUser } from "@/lib/supabase/server";

type Result = { ok: true; token: string | null } | { ok: false; error: string };
const NOT_READY = "Per condividere le schede serve l'aggiornamento del database 0050.";
const MISSING = /relation|does not exist|schema cache/i;

function validCode(code: string) {
  return /^[A-Z]{2}$/.test(code);
}

// Il link pubblico attuale della scheda di un paese, se esiste
export async function getSheetShare(code: string): Promise<Result> {
  if (!validCode(code)) return { ok: false, error: "Paese non valido." };
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("sheet_shares").select("token").eq("owner_id", user.id).eq("country_code", code).maybeSingle();
  if (error) return { ok: false, error: MISSING.test(error.message) ? NOT_READY : "Non riesco a leggere il link, riprova." };
  return { ok: true, token: (data as { token: string } | null)?.token ?? null };
}

// Crea (o restituisce) il link pubblico della scheda
export async function createSheetShare(code: string): Promise<Result> {
  const existing = await getSheetShare(code);
  if (!existing.ok || existing.token) return existing;
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const supabase = await createClient();
  const token = randomBytes(18).toString("base64url");
  const { error } = await supabase.from("sheet_shares").insert({ token, owner_id: user.id, country_code: code });
  if (error) return { ok: false, error: MISSING.test(error.message) ? NOT_READY : "Non riesco a creare il link, riprova." };
  return { ok: true, token };
}

// Smette di condividere: il vecchio link non funziona più
export async function revokeSheetShare(code: string): Promise<Result> {
  if (!validCode(code)) return { ok: false, error: "Paese non valido." };
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const supabase = await createClient();
  const { error } = await supabase.from("sheet_shares").delete().eq("owner_id", user.id).eq("country_code", code);
  if (error) return { ok: false, error: "Non riesco a revocare il link, riprova." };
  return { ok: true, token: null };
}
