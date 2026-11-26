import { createClient } from "@supabase/supabase-js";
import { buildIcs, type IcsRow } from "@/lib/network/ics";

// Calendario dei servizi per il telefono (Apple, Google, Outlook): si aggiunge una volta come «calendario in abbonamento»
// e si aggiorna da solo. Il link contiene un codice privato (come una password): chi ha il link vede i servizi.
// Si può generare un nuovo link dall'Agenda: quello vecchio smette di funzionare.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Calendario non trovato", { status: 404 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.rpc("network_calendar_feed", { p_token: token });
  if (error) return new Response("Calendario non disponibile", { status: 503 });
  const rows = (data ?? []) as IcsRow[];
  // token sconosciuto o revocato: 404, così l'app del calendario smette di aggiornarlo
  if (!rows.length) {
    const { data: exists } = await supabase.rpc("network_calendar_exists", { p_token: token });
    if (exists !== true) return new Response("Calendario non trovato", { status: 404 });
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://grandroute.it";
  const body = buildIcs(rows, { site });
  const download = new URL(request.url).searchParams.get("scarica") === "1";
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="grand-route-servizi.ics"`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
