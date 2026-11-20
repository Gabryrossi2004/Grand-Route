import type { Activity, Trip, TripDay } from "@/lib/types";
import { ENTRY_REQUIREMENTS, ID_CARD_OK } from "@/data/entryRequirements";

const regionName = new Intl.DisplayNames(["it"], { type: "region" });

// Controllo prima di mandare l'itinerario al cliente: cose che di solito si
// dimenticano. Si calcola dai dati del viaggio, senza AI (quindi gratis e
// immediato). Per una rilettura più approfondita c'è "Suggerimenti" di Zefiro.
export type PreflightIssue = { level: "problema" | "attenzione" | "nota"; text: string };

type DayWithActivities = TripDay & { activities: Activity[] };

const NO_TIME_NEEDED = new Set(["info", "altro"]);

function list(values: string[], max = 4) {
  return values.length <= max ? values.join(", ") : `${values.slice(0, max).join(", ")} e altri ${values.length - max}`;
}

export function checkTripBeforeSend(params: {
  trip: Pick<Trip, "start_date" | "end_date" | "destination" | "cover_image_url">;
  days: DayWithActivities[];
  paymentsCount: number;
  countries?: string[];
}): PreflightIssue[] {
  const { trip, paymentsCount } = params;
  const days = [...params.days].sort((a, b) => a.day_order - b.day_order);
  const issues: PreflightIssue[] = [];

  if (days.length === 0) {
    issues.push({ level: "problema", text: "L'itinerario non ha ancora nessun giorno." });
    return issues;
  }

  if (trip.start_date && trip.end_date && trip.end_date.slice(0, 10) < trip.start_date.slice(0, 10)) {
    issues.push({ level: "problema", text: "La data di fine del viaggio è precedente a quella di partenza." });
  }
  if (!trip.start_date) issues.push({ level: "attenzione", text: "Manca la data di partenza del viaggio." });
  else if (days[0].day_date && days[0].day_date.slice(0, 10) !== trip.start_date.slice(0, 10)) {
    issues.push({ level: "attenzione", text: "La data del primo giorno non coincide con la data di partenza del viaggio." });
  }
  const last = days[days.length - 1];
  if (trip.end_date && last.day_date && last.day_date.slice(0, 10) !== trip.end_date.slice(0, 10)) {
    issues.push({ level: "attenzione", text: "La data dell'ultimo giorno non coincide con la data di fine del viaggio." });
  }

  const emptyDays = days.flatMap((d, i) => (d.activities.length === 0 ? [`giorno ${i + 1}`] : []));
  if (emptyDays.length > 0) {
    issues.push({ level: "attenzione", text: `Senza attività: ${list(emptyDays)}. Il cliente li vedrà vuoti.` });
  }

  const all = days.flatMap((d) => d.activities);
  if (days.length >= 2 && !all.some((a) => a.activity_type === "alloggio")) {
    issues.push({ level: "attenzione", text: "Non c'è nessun alloggio nell'itinerario." });
  }

  days.forEach((day, index) => {
    const seen = new Map<string, string>();
    for (const activity of day.activities) {
      if (!activity.start_time || NO_TIME_NEEDED.has(activity.activity_type)) continue;
      const time = activity.start_time.slice(0, 5);
      const other = seen.get(time);
      if (other) {
        issues.push({
          level: "attenzione",
          text: `Giorno ${index + 1}: «${other}» e «${activity.title}» hanno lo stesso orario (${time}).`,
        });
      } else {
        seen.set(time, activity.title);
      }
    }
  });

  const noTime = all.filter((a) => !a.start_time && !NO_TIME_NEEDED.has(a.activity_type));
  if (noTime.length > 0) {
    issues.push({ level: "nota", text: `${noTime.length} ${noTime.length === 1 ? "attività senza orario" : "attività senza orario"}.` });
  }
  const noDescription = all.filter((a) => !String(a.description ?? "").replace(/<[^>]+>/g, "").trim() && a.activity_type !== "info");
  if (noDescription.length > 0) {
    issues.push({
      level: "nota",
      text: `${noDescription.length} ${noDescription.length === 1 ? "attività senza descrizione" : "attività senza descrizione"}.`,
    });
  }
  // Documenti d'ingresso per i paesi del viaggio
  const codes = [...new Set(params.countries ?? [])];
  for (const code of codes) {
    const req = ENTRY_REQUIREMENTS[code];
    if (req) issues.push({ level: "attenzione", text: `${regionName.of(code) ?? code}: serve ${req.doc} (${req.how}). Ricordalo al cliente almeno ${req.days} giorni prima.` });
  }
  if (codes.some((c) => !ID_CARD_OK.has(c))) {
    issues.push({ level: "nota", text: "Serve il passaporto, di solito valido almeno 6 mesi dopo il rientro: verifica la scadenza nell'anagrafica del cliente." });
  }
  if (!trip.destination) issues.push({ level: "nota", text: "Manca la destinazione: il cliente non vedrà il meteo del viaggio." });
  if (paymentsCount === 0) issues.push({ level: "nota", text: "Nessun pagamento pianificato: il cliente non vedrà scadenze." });
  if (!trip.cover_image_url) issues.push({ level: "nota", text: "Manca la foto di copertina." });

  const order = { problema: 0, attenzione: 1, nota: 2 } as const;
  return issues.sort((a, b) => order[a.level] - order[b.level]);
}
