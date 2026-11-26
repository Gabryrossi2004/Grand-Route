"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { generatePublicSlug } from "@/lib/slug";
import { addDaysIso } from "@/lib/itineraryInsert";

type FormState = { error?: string; success?: boolean } | undefined;

export async function travelerSignup(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (password.length < 6) return { error: "La password deve avere almeno 6 caratteri." };
  if (!formData.get("acceptTerms")) return { error: "Devi accettare i Termini di Servizio e l'Informativa sulla Privacy." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // «account_kind» dice al database che è un viaggiatore (migrazione 0058)
    options: { data: { full_name: fullName, account_kind: "traveler" } },
  });
  if (error) return { error: error.message };
  // Senza conferma email c'è già una sessione: si entra subito
  if (data.session) redirect("/viaggiatore");
  return { success: true };
}

export async function travelerSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/clienti");
}

// Viaggio vuoto: titolo, destinazione, giorni (e data di partenza, se la sai)
export async function createTravelerTrip(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string } | undefined> {
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const destination = String(formData.get("destination") ?? "").trim().slice(0, 120) || null;
  const days = Math.min(30, Math.max(1, Math.trunc(Number(formData.get("days")) || 5)));
  const startRaw = String(formData.get("start_date") ?? "");
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : null;
  if (title.length < 2) return { error: "Scrivi un titolo per il viaggio." };

  const supabase = await createClient();
  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      title,
      destination,
      start_date: start,
      end_date: start ? addDaysIso(start, days - 1) : null,
      public_slug: generatePublicSlug(),
    })
    .select("id")
    .single();
  if (error || !trip) return { error: "Non sono riuscito a creare il viaggio. Riprova." };
  const { error: daysError } = await supabase.from("trip_days").insert(
    Array.from({ length: days }, (_, i) => ({ trip_id: trip.id, day_order: i, day_date: start ? addDaysIso(start, i) : null })),
  );
  if (daysError) {
    await supabase.from("trips").delete().eq("id", trip.id);
    return { error: "Non sono riuscito a creare i giorni del viaggio. Riprova." };
  }
  revalidatePath("/viaggiatore");
  redirect(`/viaggiatore/viaggi/${trip.id}`);
}

export async function deleteTravelerTrip(tripId: string): Promise<{ error: string } | undefined> {
  const user = await getCachedUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("trips").delete({ count: "exact" }).eq("id", tripId).eq("owner_id", user.id);
  if (error) return { error: "Non sono riuscito a eliminare il viaggio. Riprova." };
  if (!count) return { error: "Viaggio non trovato." };
  revalidatePath("/viaggiatore");
  redirect("/viaggiatore");
}
