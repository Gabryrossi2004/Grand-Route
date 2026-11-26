// Calendario del telefono (iCalendar, RFC 5545): i servizi del professionista come eventi.
// Gli orari sono «flottanti» (senza fuso): 11:55 resta 11:55 nel luogo del servizio, ovunque sia il telefono.

export type IcsRow = {
  id: string;
  role: "seller" | "buyer";
  counterpart_name: string;
  title: string;
  details: string | null;
  service_date: string;
  end_date: string | null;
  start_time: string | null;
  place: string | null;
  pax: number | null;
  lead_name: string | null;
  reference: string | null;
  status: string;
  updated_at: string;
};

const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Le righe non possono superare 75 byte: si va a capo (CRLF + spazio) senza spezzare un carattere
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // le righe successive iniziano con uno spazio
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const ymd = (iso: string) => iso.replace(/-/g, "");
const addDay = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildIcs(rows: IcsRow[], opts: { name?: string; site?: string } = {}): string {
  const site = opts.site ?? "https://grandroute.it";
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Grand Route//Servizi//IT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  lines.push(`X-WR-CALNAME:${esc(opts.name ?? "Grand Route – Servizi")}`, "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H");
  for (const r of rows) {
    const multiDay = !!r.end_date && r.end_date !== r.service_date;
    const time = r.start_time?.slice(0, 5) ?? null;
    lines.push("BEGIN:VEVENT", `UID:order-${r.id}@grandroute.it`, `DTSTAMP:${stamp(r.updated_at)}`, `LAST-MODIFIED:${stamp(r.updated_at)}`);
    if (time && !multiDay) {
      const [h, m] = time.split(":").map(Number);
      const endMin = h * 60 + m + 60;
      const endDay = endMin >= 24 * 60 ? addDay(r.service_date, 1) : r.service_date;
      const eh = Math.floor((endMin % (24 * 60)) / 60);
      const em = endMin % 60;
      lines.push(`DTSTART:${ymd(r.service_date)}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`);
      lines.push(`DTEND:${ymd(endDay)}T${String(eh).padStart(2, "0")}${String(em).padStart(2, "0")}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(r.service_date)}`);
      lines.push(`DTEND;VALUE=DATE:${ymd(addDay(r.end_date && multiDay ? r.end_date : r.service_date, 1))}`);
    }
    lines.push(`SUMMARY:${esc(r.status === "richiesto" ? `${r.title} (da confermare)` : r.title)}`);
    if (r.place) lines.push(`LOCATION:${esc(r.place)}`);
    const desc = [
      `${r.role === "seller" ? "Cliente" : "Fornitore"}: ${r.counterpart_name}`,
      r.pax ? `Persone: ${r.pax}` : null,
      r.lead_name ? `Riferimento: ${r.lead_name}` : r.reference ? `Riferimento: ${r.reference}` : null,
      r.details ? `\n${r.details}` : null,
      `\nApri su Grand Route: ${site}/rete/agenda`,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push(`STATUS:${r.status === "confermato" ? "CONFIRMED" : "TENTATIVE"}`, "TRANSP:OPAQUE", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
