"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { SupplierCategory } from "@/lib/types";
import { validateSpreadsheetFile, validateTextFile } from "@/lib/fileValidation";
import { parseExcelToText } from "@/lib/itineraryFileParsing";
import { extractPriceListItems, type PriceListExtraction } from "@/lib/priceListAi";

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

// Listino prezzi del fornitore: catalogo riutilizzabile, indipendente dai
// viaggi (vedi migrazione 0027 per i dettagli).
function readPriceListItemFields(formData: FormData) {
  return {
    category: (String(formData.get("category") ?? "altro") || "altro") as SupplierCategory,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    price: formData.get("price") ? Number(formData.get("price")) : null,
    unit: String(formData.get("unit") ?? "").trim() || null,
    valid_from: String(formData.get("valid_from") ?? "") || null,
    valid_to: String(formData.get("valid_to") ?? "") || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createPriceListItem(supplierId: string, formData: FormData) {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return;

  const fields = readPriceListItemFields(formData);
  if (!fields.title) return;

  await supabase.from("supplier_price_list_items").insert({ owner_id: user.id, supplier_id: supplierId, ...fields });
  revalidatePath("/dashboard/suppliers");
}

export async function updatePriceListItem(itemId: string, formData: FormData) {
  const supabase = await createClient();
  const fields = readPriceListItemFields(formData);
  if (!fields.title) return;

  await supabase.from("supplier_price_list_items").update(fields).eq("id", itemId);
  revalidatePath("/dashboard/suppliers");
}

export async function deletePriceListItem(itemId: string) {
  const supabase = await createClient();
  await supabase.from("supplier_price_list_items").delete().eq("id", itemId);
  revalidatePath("/dashboard/suppliers");
}

// Legge un file di listino (Excel/CSV/testo) e lo fa interpretare dall'AI,
// restituendo le voci proposte SENZA salvarle: l'agente le rivede e le
// corregge prima di confermare (saveePriceListItems), così un'estrazione
// imprecisa non finisce mai in rubrica senza controllo.
export async function extractPriceListFromFile(
  formData: FormData,
): Promise<{ items: PriceListExtraction["items"] } | { error: string }> {
  const text = String(formData.get("draft_text") ?? "").trim();
  let draftText = text;

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      const validationError = validateSpreadsheetFile(file);
      if (validationError) return { error: validationError };
      const buffer = Buffer.from(await file.arrayBuffer());
      let fileText: string;
      try {
        fileText = await parseExcelToText(buffer);
      } catch {
        return { error: "Non sono riuscito a leggere il file Excel. Controlla che sia un file .xlsx valido." };
      }
      draftText = [draftText, fileText].filter(Boolean).join("\n\n");
    } else if (file.name.toLowerCase().endsWith(".csv")) {
      const validationError = validateSpreadsheetFile(file);
      if (validationError) return { error: validationError };
      const buffer = Buffer.from(await file.arrayBuffer());
      draftText = [draftText, buffer.toString("utf-8")].filter(Boolean).join("\n\n");
    } else if (file.name.toLowerCase().endsWith(".txt") || file.name.toLowerCase().endsWith(".md")) {
      const validationError = validateTextFile(file);
      if (validationError) return { error: validationError };
      const buffer = Buffer.from(await file.arrayBuffer());
      draftText = [draftText, buffer.toString("utf-8")].filter(Boolean).join("\n\n");
    } else {
      return { error: "Formato non supportato: carica un file Excel (.xlsx), un .csv o un testo (.txt/.md)." };
    }
  }

  if (!draftText) return { error: "Incolla il testo del listino, oppure carica un file Excel, CSV o di testo." };

  try {
    const result = await extractPriceListItems(draftText);
    return { items: result.items };
  } catch {
    return { error: "Non sono riuscito a interpretare il listino. Riprova, o inserisci le voci a mano." };
  }
}

export async function savePriceListItems(supplierId: string, items: PriceListExtraction["items"]) {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user || items.length === 0) return;

  await supabase.from("supplier_price_list_items").insert(
    items.map((item) => ({
      owner_id: user.id,
      supplier_id: supplierId,
      ...item,
    })),
  );
  revalidatePath("/dashboard/suppliers");
}
