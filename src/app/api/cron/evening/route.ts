import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";

// Chiamata ogni sera da Vercel Cron (vedi vercel.json): ai clienti in viaggio arriva l'invito a
// scrivere il diario della giornata, con il luogo del programma di oggi. Solo per le agenzie che
// hanno attivato i «Messaggi automatici ai clienti». Senza la migrazione 0055 non parte nulla.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.rpc("get_traveling_client_targets", { p_secret: process.env.CRON_SECRET });
  if (error) {
    console.error("[cron sera] diario:", error.message);
    return NextResponse.json({ sent: 0 });
  }
  type Row = PushTarget & { trip_id: string; trip_title: string; agency_name: string; day_title: string | null; place: string | null };
  const rows = (data as Row[] | null) ?? [];
  await Promise.all(
    rows.map((row) => {
      const where = row.place || row.day_title;
      return sendPushToTargets([row], {
        title: "Com'è andata oggi?",
        body: `${where ? `Una giornata a ${where}: ` : ""}scrivi due righe nel tuo diario di viaggio, prima di dimenticarle.`,
        url: `/client/diario?trip=${row.trip_id}`,
      });
    }),
  );
  return NextResponse.json({ sent: rows.length });
}
