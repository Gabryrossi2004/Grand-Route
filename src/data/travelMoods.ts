// «Che viaggio sogni?»: atmosfere delle mete di «Il tuo prossimo viaggio», per i filtri dell'esploratore.
export type Mood = "mare" | "natura" | "cultura" | "avventura" | "citta" | "safari" | "nord";

export const MOOD_LABELS: Record<Mood, string> = {
  mare: "Mare e isole",
  natura: "Natura",
  cultura: "Arte e storia",
  avventura: "Avventura",
  citta: "Città",
  safari: "Animali e safari",
  nord: "Neve e aurore",
};

const m: Record<string, Mood> = { m: "mare", n: "natura", c: "cultura", a: "avventura", t: "citta", s: "safari", f: "nord" };
const RAW: Record<string, string> = {
  AE: "mt", AL: "mc", AR: "nat", AT: "ncf", AU: "mnas", BE: "ct", BO: "na", BR: "mnt", BS: "m", BT: "cna", BW: "sn", BZ: "mn",
  CA: "naft", CH: "nf", CK: "m", CL: "na", CN: "ct", CO: "ncm", CR: "nsam", CU: "mc", CV: "mn", CY: "mc", CZ: "ct", DE: "ct",
  DO: "m", EC: "nsa", EE: "ct", EG: "cm", ES: "mct", FI: "fn", FJ: "m", FO: "na", FR: "ct", GB: "ct", GE: "nca", GL: "fna",
  GR: "mc", GT: "cn", HK: "t", HR: "mc", HU: "ct", ID: "mnc", IE: "nc", IL: "c", IN: "c", IS: "nfa", JM: "m", JO: "ca",
  JP: "ct", KE: "s", KG: "na", KH: "c", KR: "tc", LA: "cn", LK: "cmns", MA: "ca", ME: "mn", MT: "mc", MU: "m", MV: "m",
  MX: "mc", MY: "tnm", NA: "nsa", NL: "tc", NO: "nf", NP: "nac", NZ: "na", OM: "nm", PA: "mn", PE: "can", PF: "m", PH: "mn",
  PT: "mct", QA: "t", RE: "nam", RW: "sn", SC: "m", SE: "fnt", SG: "t", SI: "n", TH: "mc", TN: "mc", TR: "ct", TW: "tn",
  TZ: "sm", US: "tn", UY: "mt", UZ: "c", VN: "cnm", ZA: "snt", ZM: "sna",
};

export const TRAVEL_MOODS: Record<string, Mood[]> = Object.fromEntries(
  Object.entries(RAW).map(([code, s]) => [code, [...s].map((ch) => m[ch])]),
);
