"use server";

import { createClient } from "@/lib/supabase/server";
import { buildTemplate } from "@/lib/messageTemplates";
import { TEMPLATE_KINDS, type TemplateKind } from "@/lib/messageTemplateKinds";
import type { Activity, Trip, TripDay, TripPayment } from "@/lib/types";
import { companyIdOf } from "@/lib/team";

// Modello di messaggio compilato con i dati del viaggio (senza AI)
export async function templateMessage(tripId: string, kind: TemplateKind): Promise<{ text?: string; error?: string }> {
  if (!TEMPLATE_KINDS.some((k) => k.id === kind)) return { error: "Modello non valido." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).eq("owner_id", companyId).maybeSingle();
  if (!trip) return { error: "Viaggio non trovato." };
  const t = trip as Trip;
  const [{ data: days }, { data: payments }, { data: client }, { data: profile }] = await Promise.all([
    supabase.from("trip_days").select("*, activities(*)").eq("trip_id", tripId).order("day_order", { ascending: true }),
    supabase.from("trip_payments").select("*").eq("trip_id", tripId).eq("direction", "incasso"),
    t.client_id ? supabase.from("clients").select("full_name").eq("id", t.client_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("agency_name, emergency_phone, ai_preferences").eq("id", companyId).maybeSingle(),
  ]);
  const prefs = (profile?.ai_preferences as Record<string, string> | null) ?? {};
  const ordered = ((days as (TripDay & { activities: Activity[] })[]) ?? []).map((d) => ({
    ...d,
    activities: [...(d.activities ?? [])].sort((a, b) => a.activity_order - b.activity_order),
  }));
  const text = buildTemplate(kind, {
    trip: t,
    days: ordered,
    payments: (payments as TripPayment[]) ?? [],
    clientName: (client as { full_name: string } | null)?.full_name ?? null,
    agencyName: (profile?.agency_name as string | null) || "L'agenzia",
    emergencyPhone: (profile?.emergency_phone as string | null) ?? null,
    formal: prefs.tone !== "tu",
  });
  return { text };
}
