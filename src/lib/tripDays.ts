import type { PostgrestError } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Carica i giorni di un viaggio con le attività (e le foto). È la lettura più importante del sito:
// se fallisce l'itinerario sembra vuoto. Per questo:
//  - se il database risponde "relazione ambigua" (succede quando una tabella ha collegamenti sia ai
//    giorni sia alle attività, es. i messaggi), si ripete indicando la colonna esatta;
//  - per gli errori temporanei (rete, database occupato) si riprova una volta dopo un attimo.
export async function loadTripDays(
  supabase: Db,
  tripId: string,
  withPhotos = true,
): Promise<{ data: unknown[] | null; error: PostgrestError | null }> {
  const inner = withPhotos ? "*, activity_photos(*)" : "*";
  const plain = `*, activities(${inner})`;
  const hinted = `*, activities!trip_day_id(${inner})`;

  const run = async (select: string) => {
    const { data, error } = await supabase.from("trip_days").select(select).eq("trip_id", tripId).order("day_order", { ascending: true });
    return { data: (data as unknown[] | null) ?? null, error };
  };

  let result = await run(plain);
  if (!result.error) return result;
  console.error("[loadTripDays] 1° tentativo:", result.error.code, result.error.message);

  const ambiguous = result.error.code === "PGRST201" || /more than one relationship/i.test(result.error.message ?? "");
  if (ambiguous) {
    result = await run(hinted);
    if (!result.error) return result;
    console.error("[loadTripDays] con indicazione della colonna:", result.error.code, result.error.message);
  }

  await wait(400);
  result = await run(ambiguous ? hinted : plain);
  if (result.error) console.error("[loadTripDays] 2° tentativo:", result.error.code, result.error.message);
  return result;
}
