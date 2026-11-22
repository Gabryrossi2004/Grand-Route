import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";

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

  return NextResponse.json({ sent: typedTargets.length, clientSent });
}
