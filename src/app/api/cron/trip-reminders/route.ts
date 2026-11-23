import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";
import { decryptField } from "@/lib/encryption";

// Chiamata una volta al giorno da Vercel Cron (vedi vercel.json): avvisa le
// agenzie dei viaggi che partono tra 3 giorni, se hanno attivato questa
// notifica nelle Impostazioni. Protetta dallo stesso CRON_SECRET che Vercel
// aggiunge automaticamente all'header Authorization delle chiamate cron.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data: targets, error } = await supabase.rpc("get_departure_reminder_push_targets", {
    p_secret: process.env.CRON_SECRET,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const typedTargets = (targets as (PushTarget & { trip_title: string })[]) || [];

  await Promise.all(
    typedTargets.map((target) =>
      sendPushToTargets([target], {
        title: "Partenza in arrivo",
        body: `Il viaggio "${target.trip_title}" parte tra 3 giorni.`,
        url: "/dashboard#calendario",
      }),
    ),
  );

  // Messaggi automatici ai clienti (se l'agenzia li ha attivati; senza la migrazione 0049 si salta)
  let clientSent = 0;
  const { data: clientTargets, error: clientError } = await supabase.rpc("get_client_auto_push_targets", {
    p_secret: process.env.CRON_SECRET,
  });
  if (clientError) {
    console.error("[cron] messaggi automatici ai clienti:", clientError.message);
  } else {
    const rows = (clientTargets as (PushTarget & { kind: string; trip_id: string; trip_title: string; agency_name: string })[]) || [];
    const text = (row: (typeof rows)[number]) => {
      const sign = row.agency_name ? ` — ${row.agency_name}` : "";
      if (row.kind === "partenza")
        return { title: "Domani si parte! ✈️", body: `Il viaggio «${row.trip_title}» inizia domani: nella tua area trovi programma, voli e documenti.${sign}` };
      if (row.kind === "benvenuto")
        return { title: "Buon viaggio!", body: `Oggi inizia «${row.trip_title}». Per qualsiasi cosa scrivici dalla tua area: siamo qui.${sign}` };
      return { title: "Bentornato!", body: `Speriamo che «${row.trip_title}» sia stato indimenticabile. Ci racconti com'è andata?${sign}` };
    };
    await Promise.all(rows.map((row) => sendPushToTargets([row], { ...text(row), url: `/client/trips/${row.trip_id}` })));
    clientSent = rows.length;
  }

  // Auguri ai clienti (compleanno e anniversario di viaggio), solo per le agenzie che li hanno attivati
  // (Impostazioni → Vantaggi per i clienti). Senza la migrazione 0054 si salta.
  let greetings = 0;
  const { data: greetRows, error: greetError } = await supabase.rpc("get_greeting_candidates", { p_secret: process.env.CRON_SECRET });
  if (greetError) {
    console.error("[cron] auguri:", greetError.message);
  } else {
    const romeMd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", month: "2-digit", day: "2-digit" }).format(new Date());
    type Greet = PushTarget & { kind: string; client_id: string; agency_name: string; dob: string | null; trip_id: string | null; trip_title: string | null };
    const rows = (greetRows as Greet[] | null) ?? [];
    const birthdayClients = new Set<string>();
    for (const row of rows) {
      const sign = row.agency_name ? ` — ${row.agency_name}` : "";
      if (row.kind === "compleanno") {
        let dob: string | null = null;
        try {
          dob = decryptField(row.dob);
        } catch {
          dob = null;
        }
        if (!dob || dob.slice(5, 10) !== romeMd) continue;
        await sendPushToTargets([row], { title: "Buon compleanno! 🎂", body: `Tanti auguri da tutti noi: ti aspettiamo per il prossimo viaggio.${sign}`, url: "/client/vantaggi" });
        birthdayClients.add(row.client_id);
        greetings++;
      } else if (row.kind === "anniversario" && row.trip_id) {
        await sendPushToTargets([row], {
          title: "Ti ricordi questo viaggio?",
          body: `Oggi è l'anniversario del rientro da «${row.trip_title}». Rivivi i ricordi nel tuo mappamondo.${sign}`,
          url: "/client/mappamondo",
        });
        greetings++;
      }
    }
    for (const clientId of birthdayClients) {
      await supabase.rpc("award_birthday_bonus", { p_secret: process.env.CRON_SECRET, p_client_id: clientId });
    }
  }

  return NextResponse.json({ sent: typedTargets.length, clientSent, greetings });
}
