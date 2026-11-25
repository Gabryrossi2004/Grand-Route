// Legge un'email di richiesta servizio (incollata) e propone i dati dell'ordine, senza intelligenza artificiale:
// cerca le etichette più usate (PICKUP, DROP OFF, TARIFFA, PAX, VOLO, ORE…) e le date scritte in italiano o in numeri.
// Niente viene salvato da solo: i campi riempiti si controllano prima di inviare l'ordine.

export type ParsedRequest = {
  title?: string;
  service_date?: string;
  start_time?: string;
  place?: string;
  pax?: string;
  lead_name?: string;
  reference?: string;
  unit_price?: string;
  details?: string;
  found: string[]; // cosa è stato riconosciuto (per mostrarlo)
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

// Anno mancante: la prima data futura (o degli ultimi 30 giorni) a partire da oggi
function withYear(day: number, month: number, year: number | null, today: string): string | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  if (year) return `${year < 100 ? 2000 + year : year}-${pad(month)}-${pad(day)}`;
  const t = new Date(`${today}T12:00:00Z`);
  let y = t.getUTCFullYear();
  const candidate = new Date(Date.UTC(y, month - 1, day, 12));
  if (candidate.getTime() < t.getTime() - 30 * 864e5) y += 1;
  return `${y}-${pad(month)}-${pad(day)}`;
}

function findDate(text: string, today: string): string | null {
  const words = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
  const re1 = new RegExp(`\\b(\\d{1,2})\\s*(?:°|º)?\\s+(${words})\\.?(?:\\s+(\\d{4}))?\\b`, "i");
  const m1 = re1.exec(text);
  const re2 = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/;
  const m2 = re2.exec(text);
  const pick = m1 && (!m2 || m1.index <= m2.index) ? "words" : m2 ? "numbers" : null;
  if (pick === "words" && m1) return withYear(Number(m1[1]), MONTHS[m1[2].toLowerCase()], m1[3] ? Number(m1[3]) : null, today);
  if (pick === "numbers" && m2) return withYear(Number(m2[1]), Number(m2[2]), m2[3] ? Number(m2[3]) : null, today);
  return null;
}

const cleanLine = (s: string) => s.replace(/\s+/g, " ").trim();
const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'(-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()) : s);

// «PICKUP: …» a inizio riga, oppure «Pick up: …» dentro una frase (fino al punto)
function label(text: string, names: string[]): string | null {
  const start = new RegExp(`^\\s*(?:${names.join("|")})\\s*[:\\-–]\\s*(.+)$`, "im").exec(text);
  if (start) return cleanLine(start[1]);
  const inline = new RegExp(`(?:^|[\\s.;,])(?:${names.join("|")})\\s*:\\s*([^.;\\n]+)`, "i").exec(text);
  return inline ? cleanLine(inline[1]) : null;
}

export function parseRequestEmail(raw: string, today: string): ParsedRequest {
  const out: ParsedRequest = { found: [], warnings: [] };
  // Solo la richiesta: si toglie la parte citata delle risposte («Da: …», «-----Original Message-----»)
  const text = raw.replace(/\r/g, "");
  const subject = /^\s*(?:oggetto|subject)\s*:\s*(.+)$/im.exec(text)?.[1]?.trim() ?? null;
  const bodyStart = text.search(/^(?:buongiorno|buonasera|salve|gentil|ciao|hello|dear|good morning)/im);
  const body = bodyStart >= 0 ? text.slice(bodyStart) : text;
  const sigCut = body.search(/^\s*(?:attendo|resto in attesa|a disposizione|cordiali saluti|saluti|grazie)\b/im);
  const core = sigCut > 0 ? body.slice(0, sigCut) : body;

  // Data: prima nel corpo della richiesta, poi nell'oggetto
  const date = findDate(core, today) ?? (subject ? findDate(subject, today) : null);
  if (date) {
    out.service_date = date;
    out.found.push("data");
  }

  const time = /\b(?:ore|alle|h\.?|at)\s*(\d{1,2})[:.](\d{2})\b/i.exec(core);
  if (time) {
    out.start_time = `${pad(Number(time[1]))}:${time[2]}`;
    out.found.push("orario");
  }

  const pax = /\b(\d{1,4})\s*(?:pax|persone|passeggeri|adulti|ospiti|people|guests)\b/i.exec(core) ?? (subject ? /\bx\s?(\d{1,3})\b/i.exec(subject) : null);
  if (pax) {
    out.pax = pax[1];
    out.found.push("persone");
  }

  const lead = /\b(sig\.?\s?r?[ia]?\.?|sigg?\.|mr\.?|mrs\.?|ms\.?)\s+([\p{L}'-]+(?:\s+[\p{L}'-]+)?)/iu.exec(core);
  if (lead && /^\p{Lu}/u.test(lead[2])) {
    const name = lead[2].split(/\s+/).filter((w) => /^\p{Lu}/u.test(w)).join(" ");
    const prefix = titleCase(lead[1].toUpperCase().replace(/\s+/g, ""));
    out.lead_name = cleanLine(`${prefix.includes(".") ? prefix : `${prefix}.`} ${titleCase(name)}`);
    out.found.push("nome di riferimento");
  }

  const pickup = label(core, ["pick ?up", "prelievo", "partenza da", "ritiro"]);
  const drop = label(core, ["drop ?off", "destinazione", "arrivo a", "rilascio"]);
  const service = label(core, ["servizio", "service", "tipo servizio", "visita", "tour", "escursione"]);
  if (pickup || drop) {
    const shortPlace = (s: string) => titleCase(s.split(/,|\bcon volo\b|\barrivano\b/i)[0].trim());
    out.title = `Transfer ${pickup ? shortPlace(pickup) : ""}${pickup && drop ? " → " : ""}${drop ? shortPlace(drop) : ""}`.trim();
    out.place = pickup ? shortPlace(pickup) : undefined;
    out.found.push("percorso");
  } else if (service) {
    out.title = titleCase(service).slice(0, 200);
    out.found.push("servizio");
  } else {
    // il servizio scritto nel testo (visita, tour, transfer… prima di «guida»), altrimenti l'oggetto
    const kinds = ["visita", "tour", "escursione", "transfer", "trasferimento", "degustazione", "cena", "pranzo", "accompagnamento", "noleggio", "guida"];
    let what: string | null = null;
    for (const k of kinds) {
      const m = new RegExp(`\\b${k}\\b[^,;.\\n]*`, "i").exec(core);
      if (m) {
        what = m[0]
          .replace(/\s+(?:per|il|al|alle|ore|dalle|on|at|for)\s+\d.*$/i, "")
          .replace(/\s+(?:per|il|al|alle|ore|di|del|on|at|for)$/i, "")
          .trim();
        if (what.length > 3) break;
      }
    }
    if (what) {
      out.title = what.replace(/^./, (c) => c.toUpperCase()).slice(0, 120);
      out.found.push("servizio");
    } else if (subject) out.title = titleCase(subject.replace(/^(?:r|re|fw|fwd|i)\s*:\s*/i, "")).slice(0, 200);
  }

  const price =
    /(?:tariffa|prezzo|costo|importo|rate|price)\s*[:\-–]?\s*(?:€|eur(?:o)?)?\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:€|eur(?:o)?)?\s*(\+\s*iva|iva\s+(?:esclusa|escl\.?)|iva\s+(?:inclusa|compresa|incl\.?))?/i.exec(core) ??
    /(?:€|eur)\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*(\+\s*iva|iva\s+(?:esclusa|inclusa|compresa))?/i.exec(core);
  if (price) {
    out.unit_price = price[1].replace(",", ".");
    out.found.push("tariffa");
    if (price[2] && /inclusa|compresa|incl/i.test(price[2])) out.warnings.push("La tariffa è IVA inclusa: nell'ordine va il prezzo senza IVA, controllalo.");
  }

  const flight = /\b(?:volo|flight)\s+([A-Z0-9]{2})\s?(\d{1,4})\b/i.exec(core);
  if (subject) {
    out.reference = subject.replace(/^(?:r|re|fw|fwd|i)\s*:\s*/i, "").slice(0, 200);
  }
  // Le righe della richiesta vanno nelle note per il fornitore, così non si perde nulla
  const lines = core
    .split("\n")
    .map(cleanLine)
    .filter((l) => l && !/^(?:buongiorno|buonasera|salve|ciao|vi scrivo|scrivo per)/i.test(l));
  if (lines.length) out.details = lines.join("\n").slice(0, 2000);
  if (flight) out.found.push(`volo ${flight[1].toUpperCase()} ${flight[2]}`);
  if (!out.service_date) out.warnings.push("Non ho trovato la data: inseriscila tu.");
  if (!out.unit_price) out.warnings.push("Non ho trovato la tariffa: inseriscila tu.");
  return out;
}
