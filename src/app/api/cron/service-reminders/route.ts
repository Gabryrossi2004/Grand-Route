import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendServiceReminders } from "@/lib/reminders/services";

// Chiamata ogni giorno da Vercel Cron (vedi vercel.json) dopo le 16:00 italiane: se un'agenzia non ha ancora
// riconfermato i servizi del giorno dopo, riceve un'email con tutti i suoi servizi (a nome del fornitore).
// Protetta dallo stesso CRON_SECRET che Vercel aggiunge alle chiamate cron. Senza la migrazione 0070 non parte nulla.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const result = await sendServiceReminders(supabase, process.env.CRON_SECRET);
  return NextResponse.json(result);
}
