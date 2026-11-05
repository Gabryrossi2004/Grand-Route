"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupplierCategory } from "@/lib/types";

function readSupplierFields(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? "").trim(),
    category: (String(formData.get("category") ?? "altro") || "altro") as SupplierCategory,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createSupplier(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const fields = readSupplierFields(formData);
  if (!fields.full_name) return;

  await supabase.from("suppliers").insert({ owner_id: user.id, ...fields });
  revalidatePath("/dashboard/suppliers");
}

export async function updateSupplier(supplierId: string, formData: FormData) {
  const supabase = await createClient();
  const fields = readSupplierFields(formData);
  if (!fields.full_name) return;

  await supabase.from("suppliers").update(fields).eq("id", supplierId);
  revalidatePath("/dashboard/suppliers");
}

export async function deleteSupplier(supplierId: string) {
  const supabase = await createClient();
  await supabase.from("suppliers").delete().eq("id", supplierId);
  revalidatePath("/dashboard/suppliers");
}
