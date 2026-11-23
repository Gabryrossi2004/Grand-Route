// Aeroporti e nomi di città per la ricerca voli e per i collegamenti a Google Voli e Skyscanner
// (file condiviso tra server e browser).

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();

export const CITY_AIRPORTS: Record<string, string> = {
  roma: "FCO", fiumicino: "FCO", ciampino: "CIA", milano: "MXP", malpensa: "MXP", linate: "LIN", bergamo: "BGY",
  "orio al serio": "BGY", venezia: "VCE", treviso: "TSF", verona: "VRN", bologna: "BLQ", torino: "TRN", genova: "GOA",
  firenze: "FLR", pisa: "PSA", napoli: "NAP", bari: "BRI", brindisi: "BDS", catania: "CTA", palermo: "PMO",
  cagliari: "CAG", olbia: "OLB", alghero: "AHO", ancona: "AOI", pescara: "PSR", "lamezia terme": "SUF", lamezia: "SUF",
  "reggio calabria": "REG", trieste: "TRS", trapani: "TPS", comiso: "CIY", rimini: "RMI", parma: "PMF", cuneo: "CUF",
  perugia: "PEG", bolzano: "BZO", "forli": "FRL", foggia: "FOG", crotone: "CRV", salerno: "QSR",
  // grandi scali e capitali europee usate spesso come partenza o scalo
  londra: "LHR", parigi: "CDG", francoforte: "FRA", monaco: "MUC", amsterdam: "AMS", madrid: "MAD", barcellona: "BCN",
  zurigo: "ZRH", vienna: "VIE", istanbul: "IST", doha: "DOH", dubai: "DXB", "abu dhabi": "AUH", lisbona: "LIS",
  bruxelles: "BRU", "new york": "JFK", atene: "ATH",
  // mete lontane più vendute (aeroporto principale)
  delhi: "DEL", "nuova delhi": "DEL", mumbai: "BOM", bangkok: "BKK", phuket: "HKT", tokyo: "NRT", osaka: "KIX",
  seul: "ICN", pechino: "PEK", shanghai: "PVG", "hong kong": "HKG", singapore: "SIN", "kuala lumpur": "KUL",
  bali: "DPS", denpasar: "DPS", giacarta: "CGK", hanoi: "HAN", "ho chi minh": "SGN", saigon: "SGN", manila: "MNL",
  colombo: "CMB", male: "MLE", maldive: "MLE", katmandu: "KTM", "los angeles": "LAX", "san francisco": "SFO",
  miami: "MIA", "las vegas": "LAS", chicago: "ORD", boston: "BOS", orlando: "MCO", toronto: "YYZ", montreal: "YUL",
  vancouver: "YVR", cancun: "CUN", "citta del messico": "MEX", avana: "HAV", "l avana": "HAV", "punta cana": "PUJ",
  "santo domingo": "SDQ", lima: "LIM", cusco: "CUZ", "buenos aires": "EZE", santiago: "SCL", "rio de janeiro": "GIG",
  "san paolo": "GRU", bogota: "BOG", "san jose": "SJO", "il cairo": "CAI", cairo: "CAI", marrakech: "RAK",
  casablanca: "CMN", tunisi: "TUN", nairobi: "NBO", zanzibar: "ZNZ", "citta del capo": "CPT", johannesburg: "JNB",
  windhoek: "WDH", mauritius: "MRU", seychelles: "SEZ", mahe: "SEZ", antananarivo: "TNR", amman: "AMM",
  "tel aviv": "TLV", muscat: "MCT", mascate: "MCT", riad: "RUH", gedda: "JED", tashkent: "TAS", sydney: "SYD",
  melbourne: "MEL", auckland: "AKL", papeete: "PPT", tahiti: "PPT", "bora bora": "BOB", reykjavik: "KEF",
  islanda: "KEF", oslo: "OSL", helsinki: "HEL", stoccolma: "ARN", copenaghen: "CPH", dublino: "DUB",
  edimburgo: "EDI", praga: "PRG", budapest: "BUD", varsavia: "WAW", cracovia: "KRK", malta: "MLA",
  tenerife: "TFS", "palma di maiorca": "PMI", maiorca: "PMI", ibiza: "IBZ", santorini: "JTR", mykonos: "JMK",
  creta: "HER", heraklion: "HER", rodi: "RHO", corfu: "CFU", porto: "OPO", "sharm el sheikh": "SSH", sharm: "SSH",
  "marsa alam": "RMF", hurghada: "HRG", tirana: "TIA", spalato: "SPU", dubrovnik: "DBV", nizza: "NCE",
  lione: "LYS", marsiglia: "MRS", siviglia: "SVQ", malaga: "AGP", ginevra: "GVA",
};

// Nomi italiani → nomi usati dall'archivio voli (in inglese)
export const CITY_EN: Record<string, string> = {
  roma: "rome", milano: "milan", venezia: "venice", napoli: "naples", firenze: "florence", torino: "turin", genova: "genoa",
  londra: "london", parigi: "paris", monaco: "munich", "monaco di baviera": "munich", francoforte: "frankfurt",
  bruxelles: "brussels", lisbona: "lisbon", atene: "athens", mosca: "moscow", pechino: "beijing", "il cairo": "cairo",
  "citta del messico": "mexico city", "citta del capo": "cape town", seul: "seoul", zurigo: "zurich", ginevra: "geneva",
  varsavia: "warsaw", praga: "prague", copenaghen: "copenhagen", stoccolma: "stockholm", edimburgo: "edinburgh",
  siviglia: "seville", tunisi: "tunis", algeri: "algiers", avana: "havana", "l avana": "havana", "san paolo": "sao paulo",
  gedda: "jeddah", riad: "riyadh", mascate: "muscat", katmandu: "kathmandu", giacarta: "jakarta", "nuova delhi": "delhi",
  "ho chi minh": "ho chi minh", saigon: "ho chi minh", "citta del guatemala": "guatemala city", "san pietroburgo": "petersburg",
  "rio de janeiro": "rio de janeiro", lione: "lyon", marsiglia: "marseille", nizza: "nice", dublino: "dublin",
  "las palmas": "las palmas", tenerife: "tenerife", maiorca: "palma", "palma di maiorca": "palma", malta: "malta",
};

export function airportCode(text: string): string | null {
  const t = text.trim();
  if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase();
  const m = t.match(/\b([A-Z]{3})\b/); // «Roma FCO», «FCO – Fiumicino»
  if (m) return m[1];
  return CITY_AIRPORTS[plain(t)] ?? null;
}

// Collegamenti gratuiti per vedere tutti i voli (anche con scalo) e i prezzi aggiornati
export function flightSearchLinks(
  from: string,
  to: string,
  date?: string | null,
  // codice dell'aeroporto di arrivo, se si conosce già dai risultati (es. «DEL» per «Delhi»)
  toIata?: string | null,
): { google: string; skyscanner: string | null } {
  const fromCode = airportCode(from);
  const toCode = toIata || airportCode(to);
  // Per Google si usa il nome della città (tutti gli aeroporti di Roma, Milano…) o il codice scritto
  const label = (text: string) => {
    const t = text.trim();
    if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase();
    return CITY_EN[plain(t)] ?? t;
  };
  const okDate = !!date && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const google = `https://www.google.com/travel/flights?hl=it&gl=it&curr=EUR&q=${encodeURIComponent(
    `Flights from ${label(from)} to ${label(to)}${okDate ? ` on ${date}` : ""}`,
  )}`;
  const skyDate = okDate ? `${date!.slice(2, 4)}${date!.slice(5, 7)}${date!.slice(8, 10)}/` : "";
  const skyscanner =
    fromCode && toCode ? `https://www.skyscanner.it/trasporti/voli/${fromCode.toLowerCase()}/${toCode.toLowerCase()}/${skyDate}` : null;
  return { google, skyscanner };
}
