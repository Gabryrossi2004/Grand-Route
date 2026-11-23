"use server";

import { createClient } from "@/lib/supabase/server";

export async function sendReferral(code: string, _prev: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  if (String(formData.get("website") ?? "")) return { ok: true }; // campo trappola per i robot
  if (formData.get("consent") !== "on") return { error: "Serve il consenso per farti contattare dall'agenzia." };
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  if (name.length < 2) return { error: "Scrivi il tuo nome." };
  if (contact.length < 3) return { error: "Lascia un'email o un numero di telefono." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_referral", {
    p_code: code,
    p_name: name.slice(0, 120),
    p_contact: contact.slice(0, 160),
    p_message: String(formData.get("message") ?? "").slice(0, 1000),
  });
  if (error || data !== true) return { error: "Non è stato possibile inviare la richiesta. Riprova più tardi." };
  return { ok: true };
}
