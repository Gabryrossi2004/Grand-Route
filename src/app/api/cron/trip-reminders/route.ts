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
        url: "/dashboard/calendar",
      }),
    ),
  );

  return NextResponse.json({ sent: typedTargets.length });
}
