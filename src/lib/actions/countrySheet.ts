"use server";

import { createClient, getCachedUser } from "@/lib/supabase/server";
import { reserveAiCall } from "@/lib/aiQuota";
import { loadAiRules } from "@/lib/aiRulesServer";
import { generateCountrySheetContent, CountrySheetSchema, type CountrySheetContent } from "@/lib/countrySheetAi";
import { findCountryPhotos, type SheetPhoto } from "@/lib/countryPhotos";
import { nameItOfCode } from "@/lib/geo/countryCodes";
import { LIBRARY_UPDATED_AT, librarySheet } from "@/lib/countrySheetLibrary";

export type CountrySheet = { code: string; content: CountrySheetContent; photos: SheetPhoto[]; updatedAt: string; fromLibrary?: boolean };
type Result = { ok: true; sheet: CountrySheet | null } | { ok: false; error: string };

const NOT_READY = "Le schede paese non sono ancora attive: serve l'aggiornamento del database (SQL 0045).";
const validCode = (code: string) => /^[A-Z]{2}$/.test(code);

async function agencyUser() {
  const user = await getCachedUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  // i clienti hanno un account ma nessun profilo agenzia: la scheda paese è solo per l'agenzia
  const { data: asClient } = await supabase.from("clients").select("id").eq("user_id", user.id).limit(1);
  if (!profile || (asClient && asClient.length > 0 && !(await ownsTrips(user.id)))) return null;
  return { user, supabase };
}

async function ownsTrips(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("trips").select("id", { count: "exact", head: true }).eq("owner_id", userId);
  return (count ?? 0) > 0;
}

export async function getCountrySheet(code: string): Promise<Result> {
  if (!validCode(code)) return { ok: false, error: "Paese non valido." };
  const ctx = await agencyUser();
  if (!ctx) return { ok: false, error: "Accesso non valido." };
  const { data, error } = await ctx.supabase
    .from("country_sheets")
    .select("country_code, content, photos, updated_at")
    .eq("owner_id", ctx.user.id)
    .eq("country_code", code)
    .maybeSingle();
  // senza una scheda personalizzata dell'agenzia: quella della libreria Grand Route, se c'è
  const fromLibrary = async (): Promise<Result> => {
    const lib = librarySheet(code);
    if (!lib) return { ok: true, sheet: null };
    let photos = lib.photos;
    // foto mancanti nella libreria: si cercano ora (le risposte di Wikipedia restano in cache per una settimana)
    if (photos.length < 4) {
      try {
        const found = await Promise.race([
          findCountryPhotos(lib.content.places.map((p) => ({ query: p.search || p.name, title: p.name }))),
          new Promise<SheetPhoto[]>((resolve) => setTimeout(() => resolve([]), 12_000)),
        ]);
        if (found.length > photos.length) photos = found;
      } catch {}
    }
    return { ok: true, sheet: { code, content: lib.content, photos, updatedAt: LIBRARY_UPDATED_AT, fromLibrary: true } };
  };
  if (error) {
    const lib = await fromLibrary();
    return lib.ok && lib.sheet ? lib : { ok: false, error: NOT_READY };
  }
  if (!data) return await fromLibrary();
  const parsed = CountrySheetSchema.safeParse(data.content);
  if (!parsed.success) return await fromLibrary();
  return { ok: true, sheet: { code, content: parsed.data, photos: (data.photos as SheetPhoto[]) ?? [], updatedAt: data.updated_at as string } };
}

export async function generateCountrySheet(code: string): Promise<Result> {
  if (!validCode(code)) return { ok: false, error: "Paese non valido." };
  const ctx = await agencyUser();
  if (!ctx) return { ok: false, error: "Accesso non valido." };

  // la tabella esiste? (meglio scoprirlo prima di spendere una chiamata all'AI)
  const probe = await ctx.supabase.from("country_sheets").select("country_code").limit(1);
  if (probe.error) return { ok: false, error: NOT_READY };

  const quota = await reserveAiCall("itinerary");
  if (!quota.ok) return { ok: false, error: quota.error };

  const name = nameItOfCode(code);
  let content: CountrySheetContent | null = null;
  try {
    const rules = await loadAiRules();
    content = await generateCountrySheetContent(name, code, rules.text);
  } catch (error) {
    console.error("[countrySheet] AI", error);
    return { ok: false, error: "Zefiro non è riuscito a preparare la scheda. Riprova tra poco." };
  }
  if (!content) return { ok: false, error: "Zefiro non è riuscito a preparare la scheda. Riprova tra poco." };

  // 4 foto dei posti più importanti (Wikimedia Commons, licenze libere)
  let photos: SheetPhoto[] = [];
  try {
    photos = await findCountryPhotos(content.places.map((p) => ({ query: p.search || `${p.name} ${name}`, title: p.name })));
  } catch (error) {
    console.error("[countrySheet] foto", error);
  }

  const updatedAt = new Date().toISOString();
  const { error } = await ctx.supabase
    .from("country_sheets")
    .upsert({ owner_id: ctx.user.id, country_code: code, content, photos, updated_at: updatedAt }, { onConflict: "owner_id,country_code" });
  if (error) {
    console.error("[countrySheet] salvataggio", error.message);
    return { ok: false, error: "Scheda preparata ma non salvata. Riprova." };
  }
  return { ok: true, sheet: { code, content, photos, updatedAt } };
}
