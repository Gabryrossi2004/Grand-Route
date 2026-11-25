import { EU_COUNTRIES, KIND_FIELDS, isBusinessKind, type BusinessKind } from "./kinds";

// Controllo dei dati dell'attività. Gira sul server (e i messaggi servono anche alla pagina).

export type FormRecord = Record<string, string | string[]>;

export type NetworkProfileData = {
  kind: BusinessKind;
  business_name: string;
  legal_form: string | null;
  country: string;
  vat_number: string;
  tax_code: string | null;
  sdi_code: string | null;
  pec: string | null;
  address: string;
  postal_code: string | null;
  city: string;
  province: string | null;
  phone: string;
  website: string | null;
  description: string;
  countries_served: string[];
  languages: string[];
  specialties: string[];
  kind_data: Record<string, string | string[]>;
};

// Partita IVA italiana: 11 cifre, l'ultima è di controllo
export function isValidItalianVat(v: string): boolean {
  if (!/^\d{11}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(v[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(v[10]);
}

const CF_PERSON = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

const str = (r: FormRecord, k: string) => {
  const v = r[k];
  return (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).toString().trim();
};
const list = (r: FormRecord, k: string, max = 30) => {
  const v = r[k];
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return [...new Set(arr.map((x) => x.trim()).filter(Boolean))].slice(0, max);
};

export function formToRecord(fd: FormData): FormRecord {
  const out: FormRecord = {};
  for (const key of new Set([...fd.keys()])) {
    if (key.startsWith("$ACTION") || key === "password") continue;
    const all = fd.getAll(key).map((x) => String(x));
    out[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}

// I campi propri dell'attività si chiamano «kd_<chiave>»
export function validateNetworkProfile(
  kind: string,
  raw: FormRecord,
): { ok: true; data: NetworkProfileData } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!isBusinessKind(kind)) return { ok: false, errors: { kind: "Scegli il tipo di attività." } };

  const business_name = str(raw, "business_name");
  if (business_name.length < 2) errors.business_name = "Scrivi il nome dell'attività.";

  const country = str(raw, "country").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) errors.country = "Scegli il paese della sede.";

  // Partita IVA o equivalente
  let vat = str(raw, "vat_number").replace(/[\s.-]/g, "").toUpperCase();
  if (country === "IT") {
    vat = vat.replace(/^IT/, "");
    if (!isValidItalianVat(vat)) errors.vat_number = "La partita IVA italiana ha 11 cifre: controlla di averla scritta giusta.";
  } else if (EU_COUNTRIES.includes(country)) {
    if (!/^[A-Z]{2}[0-9A-Z+*.]{2,12}$/.test(vat)) errors.vat_number = "Scrivi il numero di partita IVA europea con le due lettere iniziali (es. FR12345678901).";
  } else if (vat.length < 4 || vat.length > 30) {
    errors.vat_number = "Scrivi il numero di registrazione fiscale o dell'attività nel tuo paese.";
  }

  let tax_code = str(raw, "tax_code").replace(/\s/g, "").toUpperCase();
  if (country === "IT" && tax_code && !CF_PERSON.test(tax_code) && !/^\d{11}$/.test(tax_code)) errors.tax_code = "Il codice fiscale non sembra corretto.";
  if (country !== "IT") tax_code = "";

  let sdi_code = str(raw, "sdi_code").toUpperCase();
  let pec = str(raw, "pec").toLowerCase();
  if (country === "IT") {
    if (sdi_code && !/^[A-Z0-9]{7}$/.test(sdi_code)) errors.sdi_code = "Il codice destinatario ha 7 caratteri.";
    if (pec && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pec)) errors.pec = "Controlla l'indirizzo PEC.";
    if (!sdi_code && !pec) errors.sdi_code = "Serve il codice destinatario (SDI) oppure la PEC, per la fattura.";
  } else {
    sdi_code = "";
    pec = "";
  }

  const address = str(raw, "address");
  if (address.length < 4) errors.address = "Scrivi l'indirizzo della sede.";
  const city = str(raw, "city");
  if (city.length < 2) errors.city = "Scrivi la città.";
  let postal_code = str(raw, "postal_code");
  let province = str(raw, "province").toUpperCase();
  if (country === "IT") {
    if (!/^\d{5}$/.test(postal_code)) errors.postal_code = "Il CAP ha 5 cifre.";
    if (!/^[A-Z]{2}$/.test(province)) errors.province = "Scrivi la sigla della provincia (es. RM).";
  } else {
    province = "";
    postal_code = postal_code.slice(0, 12);
  }

  const phone = str(raw, "phone");
  if (!/^[+0-9 ()./-]{6,25}$/.test(phone)) errors.phone = "Scrivi un numero di telefono, anche con il prefisso (+39…).";

  let website = str(raw, "website");
  if (website) {
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    try {
      const u = new URL(website);
      if (!u.hostname.includes(".")) throw new Error("x");
      website = u.toString();
    } catch {
      errors.website = "Controlla l'indirizzo del sito.";
    }
  }

  const description = str(raw, "description");
  if (description.length < 40) errors.description = "Racconta in almeno qualche riga cosa fai (minimo 40 caratteri).";
  if (description.length > 700) errors.description = "Massimo 700 caratteri.";

  const countries_served = list(raw, "countries_served", 20).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
  if (countries_served.length === 0) errors.countries_served = "Indica almeno un paese in cui operi.";
  const languages = list(raw, "languages", 12);
  if (languages.length === 0) errors.languages = "Indica almeno una lingua.";
  const specialties = list(raw, "specialties", 8).map((s) => s.slice(0, 40));

  // Campi propri dell'attività
  const kind_data: Record<string, string | string[]> = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const f of KIND_FIELDS[kind]) {
    const name = `kd_${f.key}`;
    if (f.type === "chips") {
      const v = list(raw, name, 10);
      if (f.required && v.length === 0) errors[name] = "Scegli almeno una voce.";
      if (v.length) kind_data[f.key] = v;
      continue;
    }
    const v = str(raw, name).slice(0, f.type === "textarea" ? 600 : 160);
    if (!v) {
      if (f.required) errors[name] = "Campo obbligatorio.";
      continue;
    }
    if (f.type === "number" && !/^\d{1,5}$/.test(v)) errors[name] = "Scrivi un numero.";
    else if (f.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[name] = "Scegli una data.";
      else if (f.key === "ins_expiry" && v < today) errors[name] = "La polizza risulta scaduta.";
    } else if (f.type === "select" && f.options && !f.options.includes(v)) errors[name] = "Scegli una voce dall'elenco.";
    if (!errors[name]) kind_data[f.key] = v;
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      kind,
      business_name: business_name.slice(0, 120),
      legal_form: str(raw, "legal_form").slice(0, 60) || null,
      country,
      vat_number: vat,
      tax_code: tax_code || null,
      sdi_code: sdi_code || null,
      pec: pec || null,
      address: address.slice(0, 160),
      postal_code: postal_code || null,
      city: city.slice(0, 80),
      province: province || null,
      phone,
      website: website || null,
      description,
      countries_served,
      languages,
      specialties,
      kind_data,
    },
  };
}

// L'utente ha compilato qualcosa nella parte «dati dell'attività»? (per le agenzie è facoltativa alla registrazione)
export function hasBusinessInput(raw: FormRecord): boolean {
  return ["business_name", "vat_number", "address", "city", "phone", "description"].some((k) => str(raw, k) !== "");
}
