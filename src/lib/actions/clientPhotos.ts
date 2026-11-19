"use server";

import { z } from "zod";
import { createClient, getCachedUser } from "@/lib/supabase/server";

// Bacheca dei ricordi: le foto che il cliente carica per ogni paese visitato.
// Sono private: ogni cliente vede solo le proprie (regole RLS su tabella e cartella).

export type CountryPhoto = { id: string; url: string; caption: string | null; tripId: string | null; createdAt: string };
export type PhotoResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const NOT_READY = "La bacheca delle foto non è ancora attiva. Riprova tra poco.";
const SIGNED_SECONDS = 60 * 60;

const countrySchema = z.string().trim().min(2).max(80);

export async function listCountryPhotos(country: string): Promise<PhotoResult<{ photos: CountryPhoto[] }>> {
  const parsed = countrySchema.safeParse(country);
  const user = await getCachedUser();
  if (!parsed.success || !user) return { ok: false, error: "Accesso non valido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_photos")
    .select("id, file_path, caption, trip_id, created_at")
    .eq("user_id", user.id)
    .eq("country", parsed.data)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[clientPhotos] list", error.message);
    return { ok: false, error: NOT_READY };
  }
  const rows = (data ?? []) as { id: string; file_path: string; caption: string | null; trip_id: string | null; created_at: string }[];
  if (rows.length === 0) return { ok: true, photos: [] };

  const { data: signed } = await supabase.storage.from("client-photos").createSignedUrls(
    rows.map((r) => r.file_path),
    SIGNED_SECONDS,
  );
  const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));
  const photos: CountryPhoto[] = rows
    .filter((r) => urlByPath.get(r.file_path))
    .map((r) => ({ id: r.id, url: urlByPath.get(r.file_path)!, caption: r.caption, tripId: r.trip_id, createdAt: r.created_at }));
  return { ok: true, photos };
}

// Quante foto ha il cliente per ogni paese (per mostrarlo sul mappamondo)
export async function countPhotosByCountry(): Promise<Record<string, number>> {
  const user = await getCachedUser();
  if (!user) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_photos").select("country").eq("user_id", user.id).limit(2000);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { country: string }[]) counts[row.country] = (counts[row.country] ?? 0) + 1;
  return counts;
}

const addSchema = z.object({
  country: countrySchema,
  path: z.string().min(10).max(300),
  tripId: z.string().uuid().nullable(),
  caption: z.string().trim().max(300).nullable(),
});

// Registra una foto già caricata (dal browser) nella cartella personale del cliente
export async function addCountryPhoto(input: z.input<typeof addSchema>): Promise<PhotoResult<{ id: string }>> {
  const parsed = addSchema.safeParse(input);
  const user = await getCachedUser();
  if (!parsed.success || !user) return { ok: false, error: "Dati non validi." };
  const { country, path, tripId, caption } = parsed.data;
  if (!path.startsWith(`${user.id}/`) || path.includes("..")) return { ok: false, error: "Dati non validi." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_photos")
    .insert({ user_id: user.id, country, file_path: path, trip_id: tripId, caption: caption || null })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[clientPhotos] add", error?.message);
    // la foto non è stata registrata: togliamo il file per non lasciare spazzatura
    await supabase.storage.from("client-photos").remove([path]);
    return { ok: false, error: error?.message?.includes("numero massimo") ? error.message : "Non sono riuscito a salvare la foto. Riprova." };
  }
  return { ok: true, id: data.id as string };
}

export async function deleteCountryPhoto(id: string): Promise<PhotoResult> {
  const user = await getCachedUser();
  if (!user || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Accesso non valido." };
  const supabase = await createClient();
  const { data: row } = await supabase.from("client_photos").select("file_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!row) return { ok: true };
  const { error } = await supabase.from("client_photos").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Non sono riuscito a eliminare la foto." };
  await supabase.storage.from("client-photos").remove([row.file_path as string]);
  return { ok: true };
}

export async function setPhotoCaption(id: string, caption: string): Promise<PhotoResult> {
  const user = await getCachedUser();
  const parsed = z.string().trim().max(300).safeParse(caption);
  if (!user || !parsed.success || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Dati non validi." };
  const supabase = await createClient();
  const { error } = await supabase.from("client_photos").update({ caption: parsed.data || null }).eq("id", id).eq("user_id", user.id);
  return error ? { ok: false, error: "Non sono riuscito a salvare la didascalia." } : { ok: true };
}
