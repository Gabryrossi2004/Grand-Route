import type { ZefiroVariantId } from "@/lib/assistant";

// Quale costume indossa Zefiro per una destinazione (modalità "dinamico").
// Confronto semplice con un elenco di parole chiave: avviene tutto nel browser,
// senza AI e senza richieste di rete. Si controlla prima la destinazione e,
// se non dice nulla, il titolo del viaggio. L'ordine conta: le mete più
// specifiche vengono prima (es. "phuket" è tropicale, "thailandia" è Asia).
const KEYWORDS: [ZefiroVariantId, string[]][] = [
  [
    "egitto",
    ["egitto", "cairo", "il cairo", "luxor", "assuan", "aswan", "giza", "nilo", "sharm", "sharm el sheikh", "hurghada", "marsa alam", "abu simbel", "siwa", "dahab"],
  ],
  [
    "grecia",
    ["grecia", "atene", "creta", "santorini", "mykonos", "rodi", "corfu", "zante", "cefalonia", "peloponneso", "meteora", "delfi", "naxos", "paros", "milos", "kos", "lefkada", "salonicco", "cicladi", "egeo", "isole greche", "olimpia"],
  ],
  [
    "giappone",
    ["giappone", "tokyo", "kyoto", "osaka", "hokkaido", "okinawa", "nara", "hiroshima", "hakone", "kanazawa", "nikko", "fuji", "sapporo", "nagoya", "kobe", "japan"],
  ],
  [
    "nordico",
    ["norvegia", "svezia", "danimarca", "finlandia", "islanda", "lapponia", "groenlandia", "fiordi", "oslo", "stoccolma", "copenaghen", "helsinki", "reykjavik", "aurora boreale", "scandinavia", "artico", "svalbard", "isole faroe", "faroe", "bergen", "tromso", "rovaniemi", "nordic", "iceland"],
  ],
  [
    "messico",
    ["messico", "cancun", "tulum", "yucatan", "oaxaca", "citta del messico", "peru", "cusco", "machu picchu", "bolivia", "colombia", "argentina", "buenos aires", "cile", "patagonia", "ecuador", "galapagos", "brasile", "rio de janeiro", "guatemala", "america latina", "sudamerica", "uruguay", "paraguay", "mexico"],
  ],
  [
    "africa",
    ["kenya", "tanzania", "serengeti", "namibia", "sudafrica", "sud africa", "botswana", "zimbabwe", "uganda", "ruanda", "etiopia", "safari", "masai mara", "kruger", "victoria falls", "cape town", "citta del capo", "zambia", "ghana", "senegal", "africa", "ngorongoro", "okavango"],
  ],
  [
    "arabo",
    ["marocco", "marrakech", "fes", "fez", "casablanca", "dubai", "abu dhabi", "emirati", "oman", "muscat", "giordania", "petra", "wadi rum", "qatar", "doha", "arabia", "arabia saudita", "turchia", "istanbul", "cappadocia", "tunisia", "algeria", "libano", "deserto", "sahara", "essaouira", "chefchaouen", "bahrein", "kuwait", "morocco", "jordan"],
  ],
  [
    "tropicale",
    ["maldive", "seychelles", "mauritius", "caraibi", "bahamas", "giamaica", "repubblica dominicana", "punta cana", "cuba", "polinesia", "bora bora", "tahiti", "fiji", "hawaii", "bali", "zanzibar", "phuket", "koh samui", "krabi", "sri lanka", "isole", "tropici", "aruba", "barbados", "santo domingo", "costa rica", "madagascar", "mar rosso", "maldives", "caribbean", "isola", "mare", "lombok", "langkawi", "boracay", "palawan"],
  ],
  [
    "seta",
    ["cina", "pechino", "shanghai", "xian", "xi an", "uzbekistan", "samarcanda", "bukhara", "khiva", "vietnam", "hanoi", "laos", "cambogia", "angkor", "thailandia", "tailandia", "bangkok", "mongolia", "tibet", "nepal", "bhutan", "corea", "seul", "taiwan", "hong kong", "singapore", "malesia", "indonesia", "via della seta", "kazakistan", "kirghizistan", "tagikistan", "india", "rajasthan", "delhi", "agra", "jaipur", "goa", "kerala", "asia", "china", "myanmar", "birmania", "filippine"],
  ],
];

function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

const NORMALIZED = KEYWORDS.map(([id, words]) => [id, words.map((word) => normalize(word))] as const);

function match(text: string): ZefiroVariantId | null {
  const haystack = normalize(text);
  if (haystack.trim() === "") return null;
  for (const [id, words] of NORMALIZED) {
    if (words.some((word) => haystack.includes(word))) return id;
  }
  return null;
}

export function costumeForDestination(destination: string | null | undefined, title?: string | null): ZefiroVariantId | null {
  return match(destination ?? "") ?? match(title ?? "");
}
