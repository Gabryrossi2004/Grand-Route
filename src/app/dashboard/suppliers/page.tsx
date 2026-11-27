import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import type { Supplier, SupplierPriceListItem } from "@/lib/types";
import SuppliersList from "@/components/SuppliersList";

export default async function SuppliersPage() {
  const supabase = await createClient();
  // Dati dell'agenzia (per un collaboratore: quelli dell'agenzia in cui lavora)
  const companyId = (await getTeamContext())?.companyId ?? "";

  const [{ data: suppliers }, { data: priceListItems }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("owner_id", companyId).order("full_name", { ascending: true }),
    supabase
      .from("supplier_price_list_items")
      .select("*")
      .eq("owner_id", companyId)
      .order("title", { ascending: true }),
  ]);

  const itemsBySupplier: Record<string, SupplierPriceListItem[]> = {};
  for (const item of (priceListItems as SupplierPriceListItem[]) || []) {
    (itemsBySupplier[item.supplier_id] ??= []).push(item);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Fornitori</h1>
        <p className="mt-1 text-sm text-slate-500">
          La rubrica di hotel, trasporti, guide e altri fornitori: riusali nei servizi dei tuoi viaggi.
        </p>
      </div>

      <SuppliersList suppliers={(suppliers as Supplier[]) || []} itemsBySupplier={itemsBySupplier} />
    </div>
  );
}
