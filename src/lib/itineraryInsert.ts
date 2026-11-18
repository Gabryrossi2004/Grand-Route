import type { SupabaseClient } from "@supabase/supabase-js";
import { detailFields } from "@/lib/activityTypes";
import type { GeneratedItinerary } from "@/lib/itineraryAi";
import type { ActivityType } from "@/lib/types";

export function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Scrive in un viaggio (già creato) i giorni e le attività di un itinerario generato.
// Con startDate le date dei giorni si calcolano da lì; senza, i giorni restano "Giorno 1, 2, 3…".
export async function insertGeneratedItinerary(
  supabase: SupabaseClient,
  tripId: string,
  generated: GeneratedItinerary,
  startDate: string | null,
): Promise<{ ok: true; days: number } | { error: string }> {
  const sortedDays = [...generated.days].sort((a, b) => a.day_index - b.day_index);
  if (sortedDays.length === 0) return { error: "Itinerario vuoto." };

  const { data: insertedDays, error: daysError } = await supabase
    .from("trip_days")
    .insert(
      sortedDays.map((day, dayOrder) => ({
        trip_id: tripId,
        day_order: dayOrder,
        day_date: startDate ? addDaysIso(startDate, dayOrder) : null,
        title: day.title || null,
      })),
    )
    .select("id, day_order");
  if (daysError || !insertedDays) return { error: "Non è stato possibile salvare i giorni." };

  const dayIdByOrder = new Map(insertedDays.map((d) => [d.day_order as number, d.id as string]));
  const rows: Record<string, unknown>[] = [];
  sortedDays.forEach((day, dayOrder) => {
    const dayId = dayIdByOrder.get(dayOrder);
    if (!dayId) return;
    day.activities.forEach((activity, activityOrder) => {
      const type = activity.activity_type as ActivityType;
      const allowed = new Set(detailFields[type].map((field) => field.key));
      const details: Record<string, string> = {};
      for (const [key, value] of Object.entries(activity.details || {})) {
        if (allowed.has(key) && typeof value === "string" && value.trim()) details[key] = value.trim();
      }
      rows.push({
        trip_day_id: dayId,
        title: activity.title || "Attività",
        start_time: activity.start_time || null,
        description: activity.description || null,
        location: activity.location || null,
        activity_type: type,
        details,
        activity_order: activityOrder,
      });
    });
  });
  if (rows.length > 0) {
    const { error } = await supabase.from("activities").insert(rows);
    if (error) return { error: "Non è stato possibile salvare le attività." };
  }
  return { ok: true, days: sortedDays.length };
}
