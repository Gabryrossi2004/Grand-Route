"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_READY = "Serve l'aggiornamento del database (migrazione 0070, in Supabase → SQL Editor).";
const fail = (m?: string): { ok: false; error: string } => ({ ok: false, error: m && !/function|relation|schema cache|does not exist|permission denied/i.test(m) ? m : NOT_READY });

// Promemoria automatico della sera prima: acceso/spento (di base è acceso)
export async function setServiceReminders(enabled: boolean): Promise<Result> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Accedi di nuovo." };
  const supabase = await createClient();
  const { error } = await supabase.from("network_prefs").upsert({ user_id: user.id, service_reminders: enabled, updated_at: new Date().toISOString() });
  if (error) return fail(error.message);
  revalidatePath("/rete/agenda");
  return { ok: true };
}

// L'agenzia riconferma uno o più servizi: l'altra parte vede «Riconfermato» e riceve una notifica
export async function reconfirmServices(ids: string[]): Promise<Result<{ count: number }>> {
  const clean = [...new Set(ids)].filter((i) => UUID.test(i)).slice(0, 100);
  if (!clean.length) return { ok: false, error: "Scegli almeno un servizio." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_reconfirm", { p_orders: clean });
  if (error) return fail(error.message);
  const rows = (data ?? []) as { order_id: string; seller_id: string; title: string }[];
  if (!rows.length) return { ok: false, error: "Questi servizi non sono più da riconfermare: ricarica la pagina." };
  // una notifica per ogni fornitore
  try {
    const bySeller = new Map<string, { first: string; n: number }>();
    for (const r of rows) {
      const cur = bySeller.get(r.seller_id);
      if (cur) cur.n++;
      else bySeller.set(r.seller_id, { first: r.order_id, n: 1 });
    }
    for (const { first, n } of bySeller.values()) {
      const { data: targets } = await supabase.rpc("network_party_push_targets", { p_order: first, p_invoice: null });
      const list = (targets as PushTarget[] | null) ?? [];
      if (list.length) await sendPushToTargets(list, { title: "Servizi riconfermati", body: n === 1 ? "Un'agenzia ha riconfermato un tuo servizio" : `Un'agenzia ha riconfermato ${n} tuoi servizi`, url: "/rete/agenda" });
    }
  } catch (e) {
    console.error("[riconferma] notifica:", (e as Error).message);
  }
  revalidatePath("/rete/agenda");
  revalidatePath("/rete/home");
  revalidatePath("/rete/riconferme");
  revalidatePath("/rete/lavori");
  return { ok: true, count: rows.length };
}

// Link privato del calendario del telefono (si crea la prima volta che lo si chiede)
export async function getCalendarToken(): Promise<Result<{ token: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_calendar_token");
  if (error || typeof data !== "string") return fail(error?.message);
  return { ok: true, token: data };
}

// Nuovo link: quello vecchio smette di funzionare (se lo hai dato a qualcuno o perso il telefono)
export async function resetCalendarToken(): Promise<Result<{ token: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_calendar_token_reset");
  if (error || typeof data !== "string") return fail(error?.message);
  return { ok: true, token: data };
}
