"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeStorageName, validateImageFile, verifyFileSignature } from "@/lib/fileValidation";

export async function updateProfile(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Devi essere loggato." };

  const accountType = String(formData.get("account_type") ?? "individual");
  const agencyName = String(formData.get("agency_name") ?? "").trim() || null;
  const brandColor = String(formData.get("brand_color") ?? "#2563eb");
  const termsAndConditions = String(formData.get("terms_and_conditions") ?? "").trim() || null;
  const uiFontSize = String(formData.get("ui_font_size") ?? "normale");
  const uiFontFamily = String(formData.get("ui_font_family") ?? "predefinito");
  const emergencyPhone = String(formData.get("emergency_phone") ?? "").trim() || null;

  const updates: Record<string, unknown> = {
    account_type: accountType === "agency" ? "agency" : "individual",
    agency_name: agencyName,
    brand_color: brandColor,
    terms_and_conditions: termsAndConditions,
    ui_font_size: ["normale", "grande", "molto_grande"].includes(uiFontSize) ? uiFontSize : "normale",
    ui_font_family: ["predefinito", "leggibile", "classico"].includes(uiFontFamily) ? uiFontFamily : "predefinito",
    emergency_phone: emergencyPhone,
    notify_trips: formData.get("notify_trips") === "on",
    notify_community: formData.get("notify_community") === "on",
    notify_emergencies: formData.get("notify_emergencies") === "on",
  };

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) return { error: "Errore durante il salvataggio." };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// Carica il logo dell'agenzia e lo collega al profilo. Restituisce { ok: true }
// oppure { error } con la causa, che la zona di caricamento mostra a schermo.
export async function uploadLogo(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Nessun file selezionato." };
  const fileError = validateImageFile(file) ?? (await verifyFileSignature(file));
  if (fileError) return { error: fileError };

  const { data: current } = await supabase.from("profiles").select("logo_url").eq("id", user.id).maybeSingle();

  const path = `${user.id}/logo-${Date.now()}-${safeStorageName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("public-assets")
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) {
    console.error("[uploadLogo]", uploadError.message);
    return { error: "Non è stato possibile caricare il logo. Riprova tra poco." };
  }

  const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
  const { error: updateError } = await supabase.from("profiles").update({ logo_url: data.publicUrl }).eq("id", user.id);
  if (updateError) {
    console.error("[uploadLogo] salvataggio:", updateError.message);
    await supabase.storage.from("public-assets").remove([path]);
    return { error: "Il logo è stato caricato ma non è stato possibile salvarlo. Riprova." };
  }

  // Pulizia: il vecchio logo non serve più (solo file della propria cartella).
  const oldPath = current?.logo_url?.split("/public-assets/")[1];
  if (oldPath && oldPath.startsWith(`${user.id}/`) && oldPath !== path) {
    await supabase.storage.from("public-assets").remove([decodeURIComponent(oldPath)]);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
