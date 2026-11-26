"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";
import { deliverReminder } from "@/lib/reminders/services";
import type { ReminderService } from "@/lib/reminders/template";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const NOT_READY = "Serve l'aggiornamento del database (migrazione 0070, in Supabase → SQL Editor).";
const fail = (m?: string): { ok: false; error: string } => ({ ok: false, error: m && !/function|relation|schema cache|does not exist|permission denied|violates/i.test(m) ? m : NOT_READY });

function refresh() {
  revalidatePath("/rete/agenda");
  revalidatePath("/rete/home");
  revalidatePath("/rete/lavori");
}

export type ReminderPrefs = { mode: "auto" | "manual" | "off"; subject: string; intro: string; outro: string };

// Promemoria della sera prima: modalità (automatico / lo rivedo io / spento) e testo dell'email (vuoto = testo standard)
export async function setReminderPrefs(p: ReminderPrefs): Promise<Result> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Accedi di nuovo." };
  if (!["auto", "manual", "off"].includes(p.mode)) return { ok: false, error: "Scelta non valida." };
  if (p.subject.length > 200 || p.intro.length > 1500 || p.outro.length > 1500) return { ok: false, error: "Il testo è troppo lungo." };
  const supabase = await createClient();
  const { error } = await supabase.from("network_prefs").upsert({
    user_id: user.id,
    reminder_mode: p.mode,
    reminder_subject: p.subject.trim() || null,
    reminder_intro: p.intro.trim() || null,
    reminder_outro: p.outro.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// Il fornitore segna che l'agenzia gli ha già riconfermato (anche per WhatsApp o telefono): niente sollecito
export async function markReconfirmReceived(ids: string[], received = true): Promise<Result<{ count: number }>> {
  const clean = [...new Set(ids)].filter((i) => UUID.test(i)).slice(0, 200);
  if (!clean.length) return { ok: false, error: "Scegli almeno un servizio." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_reconfirm_received", { p_orders: clean, p_received: received });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, count: Number(data) || 0 };
}

// Invio dell'email di riconferma, scritta (e magari modificata) dal fornitore: una sola email in blocco per agenzia
export async function sendReminderDraft(input: { buyerId: string; subject: string; body: string }): Promise<Result> {
  if (!UUID.test(input.buyerId)) return { ok: false, error: "Agenzia non valida." };
  const subject = input.subject.trim().slice(0, 200);
  const body = input.body.trim().slice(0, 20000);
  if (!subject) return { ok: false, error: "Scrivi l'oggetto dell'email." };
  if (body.length < 10) return { ok: false, error: "Il testo dell'email è troppo corto." };
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Accedi di nuovo." };
  const { data, error } = await supabase.rpc("network_reminder_claim", { p_buyer: input.buyerId });
  if (error) return fail(error.message);
  const row = (data as { buyer_name: string; buyer_email: string; seller_name: string; seller_email: string | null }[] | null)?.[0];
  if (!row?.buyer_email || row.buyer_email.endsWith("@demo.grandroute.invalid")) return { ok: false, error: "Questo è un profilo di prova: non ha un indirizzo email vero." };
  const sent = await deliverReminder({ to: row.buyer_email, subject, body, sellerId: user.id, sellerName: row.seller_name, sellerEmail: row.seller_email });
  if (!sent.ok) return { ok: false, error: sent.error === "not_configured" ? "L'invio delle email non è ancora configurato sul sito." : "Non sono riuscito a inviare l'email: riprova tra poco." };
  const { error: markError } = await supabase.rpc("network_reminder_mark_sent", { p_buyer: input.buyerId });
  if (markError) console.error("[riconferma] segno invio:", markError.message);
  // notifica all'agenzia (se ha il telefono collegato): usa il primo servizio della bozza
  try {
    const { data: drafts } = await supabase.rpc("network_reminder_drafts");
    const d = ((drafts ?? []) as { buyer_id: string; services: ReminderService[] }[]).find((x) => x.buyer_id === input.buyerId);
    const first = d?.services?.[0]?.id;
    if (first) {
      const { data: targets } = await supabase.rpc("network_party_push_targets", { p_order: first, p_invoice: null });
      const list = (targets as PushTarget[] | null) ?? [];
      if (list.length) await sendPushToTargets(list, { title: "Riconferma dei servizi", body: `${row.seller_name} chiede di riconfermare i servizi: guarda la tua email`, url: "/rete/posta" });
    }
  } catch (e) {
    console.error("[riconferma] notifica:", (e as Error).message);
  }
  refresh();
  return { ok: true };
}

// ---------- Calendario interno: i tuoi impegni ----------
export async function addCalendarEvent(input: { kind: "non_disponibile" | "nota"; title: string; from: string; to: string }): Promise<Result> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Accedi di nuovo." };
  if (!["non_disponibile", "nota"].includes(input.kind)) return { ok: false, error: "Scelta non valida." };
  if (!ISO.test(input.from) || !ISO.test(input.to)) return { ok: false, error: "Scegli le date." };
  if (input.to < input.from) return { ok: false, error: "L'ultimo giorno non può essere prima del primo." };
  if (new Date(`${input.to}T12:00:00Z`).getTime() - new Date(`${input.from}T12:00:00Z`).getTime() > 366 * 86_400_000) return { ok: false, error: "Al massimo un anno." };
  const title = input.title.trim().slice(0, 120);
  if (input.kind === "nota" && !title) return { ok: false, error: "Scrivi la nota." };
  const supabase = await createClient();
  const { error } = await supabase.from("network_calendar_events").insert({ user_id: user.id, kind: input.kind, title, day_from: input.from, day_to: input.to });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deleteCalendarEvent(id: string): Promise<Result> {
  if (!UUID.test(id)) return { ok: false, error: "Impegno non valido." };
  const supabase = await createClient();
  const { error } = await supabase.from("network_calendar_events").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}
