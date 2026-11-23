// «Il tuo prossimo viaggio»: mete simili a quelle già visitate dal cliente, scelte con regole
// semplici (senza AI) tra quelle con itinerari pronti nella libreria.
const AFFINITY: Record<string, string[]> = {
  TH: ["VN", "ID", "LK", "KH", "MY", "PH"], VN: ["KH", "LA", "TH", "ID", "JP"], ID: ["TH", "MY", "PH", "LK", "MV"],
  JP: ["KR", "TW", "VN", "CN", "HK"], KR: ["JP", "TW", "VN"], CN: ["JP", "KR", "VN", "HK"], IN: ["LK", "NP", "BT", "OM"],
  LK: ["MV", "IN", "TH", "SC"], MV: ["SC", "MU", "LK", "PF"], SC: ["MU", "MV", "ZA", "TZ"], MU: ["SC", "RE", "ZA", "MV"],
  EG: ["JO", "MA", "OM", "TN"], JO: ["EG", "OM", "IL", "AE"], MA: ["TN", "JO", "PT", "EG"], AE: ["OM", "JO", "QA", "MV"],
  OM: ["AE", "JO", "UZ", "IN"], TR: ["GR", "JO", "UZ", "GE"], UZ: ["KG", "TR", "OM", "GE"],
  KE: ["TZ", "ZA", "BW", "RW"], TZ: ["KE", "ZA", "MU", "RW"], ZA: ["NA", "BW", "MU", "TZ"], NA: ["BW", "ZA", "ZM"],
  US: ["CA", "MX", "CU", "BS"], CA: ["US", "IS", "NO"], MX: ["CU", "CR", "GT", "BZ", "PE"], CU: ["MX", "DO", "JM", "CR"],
  DO: ["CU", "MX", "JM", "BS"], CR: ["PA", "MX", "EC", "PE"], PE: ["BO", "EC", "CL", "AR"], AR: ["CL", "BR", "PE", "UY"],
  BR: ["AR", "PE", "CO", "UY"], CL: ["AR", "PE", "BO"], CO: ["PE", "EC", "CR", "MX"],
  IS: ["NO", "FO", "FI", "GL"], NO: ["IS", "FI", "SE", "FO"], FI: ["NO", "SE", "IS", "EE"], GB: ["IE", "IS", "NO", "PT"],
  IE: ["GB", "IS", "PT"], ES: ["PT", "MA", "GR", "HR"], PT: ["ES", "MA", "CV", "IE"], GR: ["CY", "TR", "HR", "MT"],
  HR: ["ME", "SI", "GR", "AL"], FR: ["ES", "PT", "CH", "BE"], DE: ["AT", "CH", "CZ", "NL"], AT: ["CH", "CZ", "HU", "SI"],
  AU: ["NZ", "FJ", "ID", "SG"], NZ: ["AU", "FJ", "PF", "CK"], PF: ["CK", "FJ", "NZ", "MV"],
};
const POPULAR = ["JP", "TH", "US", "MX", "EG", "ZA", "PE", "IS", "VN", "LK", "MA", "TZ", "PT", "NO", "AU"];

export function suggestNextCountries(visited: string[], available: (code: string) => boolean, count = 3): string[] {
  const seen = new Set(visited.map((c) => c.toUpperCase()));
  const out: string[] = [];
  const add = (c: string) => {
    if (!seen.has(c) && !out.includes(c) && available(c)) out.push(c);
  };
  // le mete più recenti contano di più
  for (const v of [...visited].reverse()) for (const c of AFFINITY[v.toUpperCase()] ?? []) add(c);
  for (const c of POPULAR) add(c);
  return out.slice(0, count);
}
