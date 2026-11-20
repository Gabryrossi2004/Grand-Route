"use server";

import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { SupplierCategory } from "@/lib/types";

export type PlaceSupplier = { id: string; full_name: string; category: SupplierCategory; email: string | null; phone: string | null; notes: string | null };
export type PlaceSuppliers = { ready: boolean; tagged: PlaceSupplier[]; used: PlaceSupplier[] };

const COLS = "id, full_name, category, email, phone, notes";
const MISSING = /column|does not exist|schema cache/i;

// I fornitori dell'agenzia legati a un paese (o a una regione italiana): quelli segnati a mano nella
// rubrica e quelli già usati nei servizi dei viaggi che toccano quel paese.
export async function getSuppliersForPlace(country: string, region?: string): Promise<PlaceSuppliers> {
  const empty: PlaceSuppliers = { ready: false, tagged: [], used: [] };
  const code = String(country ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return empty;
  const user = await getCachedUser();
  if (!user) return empty;
  const supabase = await createClient();

  const tagged = await supabase.from("suppliers").select(`${COLS}, regions`).eq("owner_id", user.id).contains("countries", [code]).order("full_name");
  if (tagged.error) return MISSING.test(tagged.error.message) ? empty : { ...empty, ready: true };
  let taggedRows = (tagged.data as (PlaceSupplier & { regions: string[] })[]) ?? [];
  if (region) taggedRows = taggedRows.filter((s) => s.regions.length === 0 || s.regions.includes(region));

  let usedRows: PlaceSupplier[] = [];
  if (!region) {
    const { data: trips } = await supabase
      .from("trips")
      .select("id")
      .eq("owner_id", user.id)
      .or(`countries.cs.{${code}},auto_countries.cs.{${code}}`)
      .limit(500);
    const tripIds = ((trips as { id: string }[] | null) ?? []).map((t) => t.id);
    if (tripIds.length) {
      const { data: services } = await supabase.from("trip_services").select("supplier_id").in("trip_id", tripIds).not("supplier_id", "is", null).limit(2000);
      const ids = [...new Set(((services as { supplier_id: string }[] | null) ?? []).map((s) => s.supplier_id))].filter((id) => !taggedRows.some((t) => t.id === id));
      if (ids.length) {
        const { data } = await supabase.from("suppliers").select(COLS).eq("owner_id", user.id).in("id", ids).order("full_name");
        usedRows = (data as PlaceSupplier[] | null) ?? [];
      }
    }
  }
  const strip = ({ id, full_name, category, email, phone, notes }: PlaceSupplier): PlaceSupplier => ({ id, full_name, category, email, phone, notes });
  return { ready: true, tagged: taggedRows.map(strip), used: usedRows };
}
