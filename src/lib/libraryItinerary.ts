// Dagli itinerari della libreria (Atlante e Italia) a un programma giorno per giorno, SENZA AI:
// si parte dal percorso («Tokyo (4) → Kyoto (3)») e si riempiono i giorni con luoghi, zone ed
// esperienze già scritti nelle schede. Se un itinerario ha il programma scritto a mano («plan»),
// si usa quello. Il risultato ha lo stesso formato delle proposte di Zefiro, così si salva allo stesso modo.
import type { GeneratedItinerary } from "@/lib/itineraryAi";
import type { ActivityType } from "@/lib/types";

export type LibraryItinerary = {
  title: string;
  days: number;
  route: string;
  description: string;
  // Programma scritto a mano: un elemento per giorno, attività nel formato «tipo|Titolo|Descrizione|Luogo»
  plan?: { t: string; a: string[] }[];
};

export type Highlight = { name: string; description: string };
export type PlaceSource = {
  places: { name: string; description: string; search?: string }[];
  areas: { name: string; description: string; highlights: (string | Highlight)[] }[];
  experiences: { name: string; description: string }[];
  domestic: boolean;
};

type Stop = { name: string; nights: number | null; note: string };
type Act = GeneratedItinerary["days"][number]["activities"][number];

const TYPES: ActivityType[] = ["volo", "alloggio", "transfer", "treno", "traghetto", "crociera", "ristorante", "attivita", "info", "altro"];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function act(type: ActivityType, title: string, description: string | null, location: string | null): Act {
  return { activity_type: type, title: title.slice(0, 200), start_time: null, description, location, details: {} };
}

export function parseRoute(route: string): Stop[] {
  return route
    .split(/\s*(?:→|->)\s*/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)\s*\(([^)]*)\)\s*(.*)$/);
      if (!m) return { name: part.replace(/^[,\s]+|[,\s]+$/g, ""), nights: null, note: "" };
      const nights = m[2].match(/(\d+)/);
      const inside = m[2].replace(/^[\d–\-\s]+,?\s*/, "");
      const after = m[3].replace(/^[,\s]+/, "");
      return { name: m[1].trim(), nights: nights ? Number(nights[1]) : null, note: [inside, after].filter(Boolean).join(", ") };
    });
}

function firstSentence(text: string) {
  const s = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return s.length > 220 ? `${s.slice(0, 217)}…` : s;
}

function transportFor(text: string): ActivityType {
  const t = norm(text);
  if (/volo|aereo/.test(t)) return "volo";
  if (/crociera/.test(t)) return "crociera";
  if (/traghetto|barca|catamarano|aliscafo|battello/.test(t)) return "traghetto";
  if (/treno|shinkansen|bernina|glacier/.test(t)) return "treno";
  return "transfer";
}

// Cose da fare in una tappa: luoghi e punti forti delle zone che la nominano, poi le esperienze
function poolFor(stop: string, src: PlaceSource): Highlight[] {
  const key = norm(stop.split(/ e | o |,/)[0].trim());
  if (key.length < 3) return [];
  const out: Highlight[] = [];
  const seen = new Set<string>();
  const add = (h: Highlight) => {
    const k = norm(h.name);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(h);
    }
  };
  // prima ciò che nomina proprio questa tappa, poi i punti forti della zona che la contiene
  for (const p of src.places) {
    if (norm(`${p.name} ${p.search ?? ""} ${p.description}`).includes(key)) add({ name: p.name, description: p.description });
  }
  for (const a of src.areas) {
    if (!norm(a.name).includes(key)) continue;
    const hs = a.highlights.map((h) => (typeof h === "string" ? { name: h, description: "" } : h));
    // in una zona con più città, prima i punti forti che citano la tappa
    hs.sort((x, y) => Number(norm(`${y.name} ${y.description}`).includes(key)) - Number(norm(`${x.name} ${x.description}`).includes(key)));
    for (const h of hs) add(h);
  }
  for (const e of src.experiences) {
    if (norm(`${e.name} ${e.description}`).includes(key)) add({ name: e.name, description: firstSentence(e.description) });
  }
  // descrizioni dei punti forti: se un luogo ha lo stesso nome, si prende la sua
  for (const h of out) {
    if (h.description) continue;
    const p = src.places.find((x) => norm(x.name) === norm(h.name));
    if (p) h.description = p.description;
  }
  return out;
}

function fromPlan(it: LibraryItinerary): GeneratedItinerary {
  return {
    days: (it.plan ?? []).map((d, i) => ({
      day_index: i,
      title: d.t,
      activities: d.a.map((line) => {
        const [type, title, description, location] = line.split("|");
        const t = (TYPES.includes(type as ActivityType) ? type : "attivita") as ActivityType;
        return act(t, title ?? "", description || null, location || null);
      }),
    })),
    agent_notes: ["Programma dalla libreria Grand Route: verifica orari, trasferimenti e disponibilità prima di confermarlo al cliente."],
    questions: [],
  };
}

export function expandItinerary(it: LibraryItinerary, src: PlaceSource): GeneratedItinerary {
  if (it.plan && it.plan.length) return fromPlan(it);

  const stops = parseRoute(it.route);
  let stays = stops.filter((s) => s.nights !== null && s.nights > 0);
  if (stays.length === 0) {
    const first = stops[0] ?? { name: it.title, nights: null, note: "" };
    stays = [{ ...first, nights: Math.max(1, it.days - 1) }];
  }
  const passagesBefore = (stay: Stop) => {
    const idx = stops.indexOf(stay);
    const prevIdx = stays.indexOf(stay) > 0 ? stops.indexOf(stays[stays.indexOf(stay) - 1]) : -1;
    return idx > 0 ? stops.slice(prevIdx + 1, idx).filter((s) => !s.nights) : [];
  };

  const days: GeneratedItinerary["days"] = [];
  const used = new Set<string>();
  const push = (title: string, activities: Act[]) => days.push({ day_index: days.length, title, activities });

  stays.forEach((stay, si) => {
    // niente luoghi che sono a loro volta un'altra tappa del viaggio (es. Hakone tra le visite di Tokyo)
    const otherStops = stops.filter((o) => o !== stay).map((o) => norm(o.name.split(/ e | o |,/)[0].trim())).filter((k) => k.length >= 3);
    const pool = poolFor(stay.name, src).filter((h) => !used.has(norm(h.name)) && !otherStops.some((k) => norm(h.name).includes(k)));
    const noteActs = stay.note ? [act("attivita", stay.note.charAt(0).toUpperCase() + stay.note.slice(1), null, stay.name)] : [];
    const visits = [...noteActs, ...pool.map((h) => act("attivita", h.name, h.description || null, stay.name))];
    let v = 0;
    const take = (n: number) => {
      const out = visits.slice(v, v + n);
      v += out.length;
      for (const x of out) used.add(norm(x.title));
      return out;
    };

    // giorno di arrivo nella tappa
    if (si === 0) {
      const a: Act[] = [];
      if (!src.domestic) a.push(act("volo", `Volo per ${stay.name}`, "Volo dall'Italia (da definire), con arrivo in giornata.", null));
      a.push(act("transfer", "Transfer in hotel", null, stay.name));
      a.push(act("alloggio", `Sistemazione a ${stay.name}`, "Hotel da scegliere in base al budget del cliente.", stay.name));
      if ((stay.nights ?? 1) <= 1) a.push(...take(1));
      push(`Arrivo a ${stay.name}`, a);
    } else {
      const prev = stays[si - 1];
      const passages = passagesBefore(stay);
      const how = transportFor(`${passages.map((p) => p.name).join(" ")} ${stay.name}`);
      const a: Act[] = [act(how, `Da ${prev.name} a ${stay.name}`, null, null)];
      for (const p of passages) {
        const pp = poolFor(p.name, src)[0];
        a.push(act("attivita", `Sosta: ${p.name}`, pp?.description || null, p.name));
      }
      a.push(act("alloggio", `Sistemazione a ${stay.name}`, "Hotel da scegliere in base al budget del cliente.", stay.name));
      // tappa di una sola notte: la visita si fa il giorno dell'arrivo
      if ((stay.nights ?? 1) <= 1) a.push(...take(2));
      push(`Da ${prev.name} a ${stay.name}`, a);
    }

    // giorni pieni nella tappa
    const full = (stay.nights ?? 1) - 1;
    for (let k = 0; k < full; k++) {
      const today = take(2);
      if (today.length === 0) {
        push(`${stay.name}: giornata libera`, [
          act("attivita", `Tempo libero a ${stay.name}`, "Giornata per rilassarsi o per un'escursione facoltativa da proporre al cliente.", stay.name),
        ]);
      } else {
        push(`${stay.name}: ${today.map((x) => x.title).join(" e ")}`.slice(0, 120), today);
      }
    }
  });

  // rientro
  const last = stays[stays.length - 1];
  push(
    src.domestic ? "Rientro" : "Partenza",
    src.domestic
      ? [act("transfer", `Rientro da ${last.name}`, null, last.name)]
      : [act("transfer", "Transfer in aeroporto", null, last.name), act("volo", "Volo di rientro in Italia", null, null)],
  );

  return {
    days,
    agent_notes: [
      "Programma creato dalla libreria Grand Route senza AI: completa orari, hotel e trasferimenti, o chiedi a Zefiro «Completa le descrizioni».",
    ],
    questions: [],
  };
}
