import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Supplier } from "@/lib/types";
import SuppliersList from "@/components/SuppliersList";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("owner_id", user?.id ?? "")
    .order("full_name", { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="border-l-4 border-[#233c5e] pl-3 text-2xl font-semibold text-slate-900">Fornitori</h1>
        <p className="mt-1 text-sm text-slate-500">
          La rubrica di hotel, trasporti, guide e altri fornitori: riusali nei servizi dei tuoi viaggi.
        </p>
      </div>

      <SuppliersList suppliers={(suppliers as Supplier[]) || []} />
    </div>
  );
}
