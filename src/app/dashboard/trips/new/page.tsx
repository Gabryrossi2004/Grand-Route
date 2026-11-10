import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import NewTripForm from "./NewTripForm";

export default async function NewTripPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("full_name", { ascending: true });

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 border-l-4 border-[#233c5e] pl-3 text-2xl font-semibold text-slate-900">Nuovo viaggio</h1>
      <NewTripForm clients={(clients as Client[]) || []} />
    </div>
  );
}
