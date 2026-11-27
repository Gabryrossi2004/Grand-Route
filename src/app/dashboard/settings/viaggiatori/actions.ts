"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { namesOf } from "@/lib/geo/countryCodes";
import { companyIdOf, getTeamContext } from "@/lib/team";

// Vetrina per i viaggiatori: l'agenzia sceglie se comparire nell'elenco e come presentarsi
export async function saveTravelerListing(formData: FormData) {
  const user = await getCachedUser();
  if (!user) return;
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) redirect("/dashboard/settings/viaggiatori?error=titolare");
  const listing = formData.get("listing") === "on";
  const blurb = String(formData.get("blurb") ?? "").trim().slice(0, 600) || null;
  const countries = [...new Set(formData.getAll("countries").map((c) => String(c).toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c) && namesOf(c).length))].slice(0, 30);
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("agency_name").eq("id", companyId).maybeSingle();
  // Senza il nome dell'agenzia i viaggiatori non saprebbero chi è
  if (listing && !String(profile?.agency_name ?? "").trim()) redirect("/dashboard/settings/viaggiatori?error=nome");
  const { error } = await supabase.from("profiles").update({ traveler_listing: listing, traveler_blurb: blurb, traveler_countries: countries }).eq("id", companyId);
  if (error) redirect("/dashboard/settings/viaggiatori?error=db");
  revalidatePath("/dashboard/settings/viaggiatori");
  redirect("/dashboard/settings/viaggiatori?saved=1");
}
