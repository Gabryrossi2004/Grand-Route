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

  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const validationError = validateImageFile(logoFile) ?? (await verifyFileSignature(logoFile));
    if (validationError) return { error: validationError };

    const path = `${user.id}/logo-${Date.now()}-${safeStorageName(logoFile.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("public-assets")
      .upload(path, logoFile, { contentType: logoFile.type || undefined });

    if (!uploadError) {
      const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
      updates.logo_url = data.publicUrl;
    }
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) return { error: "Errore durante il salvataggio." };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
