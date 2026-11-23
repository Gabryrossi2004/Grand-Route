"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";

const PATH = "/dashboard/settings/vantaggi";

export async function saveLoyalty(formData: FormData) {
  const user = await getCachedUser();
  if (!user) return;
  const levels = [0, 1, 2, 3, 4]
    .map((i) => ({
      name: String(formData.get(`level_name_${i}`) ?? "").trim().slice(0, 40),
      min: Math.max(0, Math.floor(Number(formData.get(`level_min_${i}`)) || 0)),
      perks: String(formData.get(`level_perks_${i}`) ?? "").trim().slice(0, 300),
    }))
    .filter((l) => l.name)
    .sort((a, b) => a.min - b.min);
  const rate = Number(String(formData.get("euros_per_point") ?? "10").replace(",", "."));
  const supabase = await createClient();
  const base = {
    owner_id: user.id,
    enabled: formData.get("enabled") === "on",
    euros_per_point: Number.isFinite(rate) && rate > 0 ? Math.min(10000, rate) : 10,
    intro: String(formData.get("intro") ?? "").trim().slice(0, 1000) || null,
    levels,
    updated_at: new Date().toISOString(),
  };
  const int = (key: string) => Math.max(0, Math.min(100000, Math.floor(Number(formData.get(key)) || 0)));
  const { error } = await supabase.from("agency_loyalty").upsert({
    ...base,
    referral_bonus: int("referral_bonus"),
    birthday_bonus: int("birthday_bonus"),
    greetings: formData.get("greetings") === "on",
  });
  // senza la migrazione 0054 le colonne nuove non esistono: si salva il resto
  if (error) await supabase.from("agency_loyalty").upsert(base);
  revalidatePath(PATH);
}

export async function addOffer(formData: FormData) {
  const user = await getCachedUser();
  if (!user) return;
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  if (title.length < 3) return;
  const until = String(formData.get("valid_until") ?? "");
  const supabase = await createClient();
  const base = {
    owner_id: user.id,
    title,
    body: String(formData.get("body") ?? "").trim().slice(0, 2000) || null,
    valid_until: /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null,
  };
  const kind = formData.get("kind") === "convenzione" ? "convenzione" : "offerta";
  const country = String(formData.get("country_code") ?? "").toUpperCase();
  let { data: row, error } = await supabase
    .from("agency_offers")
    .insert({
      ...base,
      kind,
      country_code: /^[A-Z]{2}$/.test(country) ? country : null,
      place: String(formData.get("place") ?? "").trim().slice(0, 80) || null,
    })
    .select("id")
    .single();
  if (error) ({ data: row, error } = await supabase.from("agency_offers").insert(base).select("id").single());
  revalidatePath(PATH);

  // Notifica ai clienti che hanno attivato le notifiche
  if (!error && row && formData.get("notify") === "on") {
    const { data: targets } = await supabase.rpc("get_offer_push_targets", { p_offer_id: row.id });
    const list = (targets as PushTarget[] | null) ?? [];
    if (list.length) {
      const { expiredEndpoints } = await sendPushToTargets(list, {
        title: kind === "convenzione" ? "Nuova convenzione per i tuoi viaggi" : "Un'offerta riservata a te",
        body: title,
        url: "/client/vantaggi",
      });
      if (expiredEndpoints.length) await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }
  }
}

export async function toggleOffer(id: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("agency_offers").update({ active }).eq("id", id);
  revalidatePath(PATH);
}

export async function deleteOffer(id: string) {
  const supabase = await createClient();
  await supabase.from("agency_offers").delete().eq("id", id);
  revalidatePath(PATH);
}

export async function addAdjustment(clientId: string, formData: FormData) {
  const user = await getCachedUser();
  if (!user) return;
  const raw = Math.trunc(Number(formData.get("points")) || 0);
  const points = formData.get("kind") === "usa" ? -Math.abs(raw) : Math.abs(raw);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  if (!points || !reason) return;
  const supabase = await createClient();
  await supabase.from("loyalty_adjustments").insert({ owner_id: user.id, client_id: clientId, points, reason });
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function deleteAdjustment(clientId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("loyalty_adjustments").delete().eq("id", id);
  revalidatePath(`/dashboard/clients/${clientId}`);
}

// Richieste di amici presentati dai clienti
export async function setLeadStatus(id: string, status: "contattata" | "archiviata") {
  const supabase = await createClient();
  await supabase.from("agency_leads").update({ status }).eq("id", id);
  revalidatePath("/dashboard/clients");
}

// L'amico diventa cliente: si crea la sua scheda e chi l'ha presentato riceve il bonus
export async function convertLead(id: string) {
  const user = await getCachedUser();
  if (!user) return;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("agency_leads").select("*").eq("id", id).maybeSingle();
  if (!lead || lead.status === "cliente") return;
  const contact = String(lead.contact);
  const email = /\S+@\S+\.\S+/.test(contact) ? contact.trim() : null;
  const phone = email ? null : contact.trim();
  await supabase.from("clients").insert({
    owner_id: user.id,
    full_name: lead.name,
    email,
    phone,
    notes: `Arrivato con «presenta un amico».${lead.message ? ` Messaggio: ${lead.message}` : ""}`.slice(0, 2000),
  });
  if (lead.referrer_client_id && !lead.bonus_given) {
    const { data: loyalty } = await supabase.from("agency_loyalty").select("enabled, referral_bonus").eq("owner_id", user.id).maybeSingle();
    const bonus = Number(loyalty?.referral_bonus ?? 0);
    if (loyalty?.enabled && bonus > 0) {
      await supabase.from("loyalty_adjustments").insert({
        owner_id: user.id,
        client_id: lead.referrer_client_id,
        points: bonus,
        reason: `Hai presentato un amico: ${String(lead.name).split(" ")[0]}`,
      });
    }
  }
  await supabase.from("agency_leads").update({ status: "cliente", bonus_given: true }).eq("id", id);
  revalidatePath("/dashboard/clients");
}
