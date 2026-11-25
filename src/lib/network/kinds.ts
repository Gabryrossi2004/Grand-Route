// Rete professionale del turismo: i tipi di attività e i dati che chiediamo a ciascuno.
// Le stesse definizioni servono alla pagina di registrazione, al profilo e al controllo sul server.

export const BUSINESS_KINDS = ["agenzia", "tour_operator", "dmc", "guida", "autista", "struttura", "esperienze", "altro"] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

// Chi vende ai clienti (o alle agenzie): usa il gestionale. Gli altri sono fornitori e usano solo la Rete.
export const TRADE_KINDS: BusinessKind[] = ["agenzia", "tour_operator", "dmc"];
export const isBusinessKind = (v: unknown): v is BusinessKind => typeof v === "string" && (BUSINESS_KINDS as readonly string[]).includes(v);
export const isTradeKind = (k: string | null | undefined): boolean => !k || TRADE_KINDS.includes(k as BusinessKind);

export type KindInfo = {
  label: string;
  short: string; // una riga per la scelta
  icon: "briefcase" | "building" | "map" | "compass" | "car" | "hotel" | "mountain" | "shapes";
};

export const KIND_INFO: Record<BusinessKind, KindInfo> = {
  agenzia: { label: "Agenzia di viaggi", short: "Vendi viaggi ai clienti finali", icon: "briefcase" },
  tour_operator: { label: "Tour operator", short: "Costruisci pacchetti e li vendi alle agenzie", icon: "building" },
  dmc: { label: "Agenzia locale (DMC)", short: "Organizzi i servizi sul posto per conto di agenzie e tour operator", icon: "map" },
  guida: { label: "Guida turistica", short: "Accompagni i viaggiatori in visita", icon: "compass" },
  autista: { label: "Autista / transfer", short: "Trasferimenti, noleggio con conducente, bus", icon: "car" },
  struttura: { label: "Hotel / struttura ricettiva", short: "Alloggi: hotel, lodge, agriturismi, appartamenti", icon: "hotel" },
  esperienze: { label: "Esperienze e attività", short: "Escursioni, cucina, safari, sport, degustazioni", icon: "mountain" },
  altro: { label: "Altro fornitore", short: "Un altro servizio per i viaggiatori", icon: "shapes" },
};

export const kindLabel = (k: string | null | undefined) => (k && isBusinessKind(k) ? KIND_INFO[k].label : "Professionista");

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "date" | "chips";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
};

const INS_COMPANY: FieldDef = { key: "ins_company", label: "Compagnia assicurativa", type: "text", required: true };
const INS_POLICY: FieldDef = { key: "ins_policy", label: "Numero di polizza", type: "text", required: true };
const INS_EXPIRY: FieldDef = { key: "ins_expiry", label: "Scadenza della polizza", type: "date", required: true };

// Dati propri di ogni attività (si salvano dentro «kind_data»)
export const KIND_FIELDS: Record<BusinessKind, FieldDef[]> = {
  agenzia: [
    { key: "auth_body", label: "Ente che ha rilasciato l'autorizzazione o la SCIA", type: "text", required: true, placeholder: "Es. Regione Lazio, Comune di Roma" },
    { key: "auth_number", label: "Numero o estremi dell'autorizzazione / SCIA", type: "text", required: true },
    { ...INS_COMPANY, label: "Assicurazione di responsabilità civile: compagnia" },
    INS_POLICY,
    INS_EXPIRY,
    { key: "bankruptcy_policy", label: "Garanzia per insolvenza o fallimento (compagnia e numero)", type: "text", help: "Serve se vendi pacchetti turistici." },
  ],
  tour_operator: [
    { key: "auth_body", label: "Ente che ha rilasciato l'autorizzazione o la SCIA", type: "text", required: true, placeholder: "Es. Regione Lombardia" },
    { key: "auth_number", label: "Numero o estremi dell'autorizzazione / SCIA", type: "text", required: true },
    { ...INS_COMPANY, label: "Assicurazione di responsabilità civile: compagnia" },
    INS_POLICY,
    INS_EXPIRY,
    {
      key: "bankruptcy_policy",
      label: "Garanzia per insolvenza o fallimento (compagnia e numero)",
      type: "text",
      required: true,
      help: "Obbligatoria per chi organizza pacchetti turistici.",
    },
    { key: "association", label: "Associazione di categoria (se ne fai parte)", type: "text", placeholder: "Es. Astoi, Fto" },
  ],
  dmc: [
    { key: "license_number", label: "Licenza o registro dell'attività nel paese in cui operi", type: "text", required: true },
    { key: "license_body", label: "Ente che l'ha rilasciata", type: "text", required: true },
    { ...INS_COMPANY, label: "Assicurazione di responsabilità civile: compagnia" },
    INS_POLICY,
    INS_EXPIRY,
    { key: "years_active", label: "Da quanti anni lavori con agenzie e tour operator", type: "number" },
  ],
  guida: [
    { key: "license_country", label: "Paese in cui sei abilitato/a", type: "text", required: true },
    { key: "license_body", label: "Ente che ha rilasciato l'abilitazione", type: "text", required: true, placeholder: "Es. Ministero del Turismo, Regione, ente locale" },
    { key: "license_number", label: "Numero di abilitazione o di iscrizione", type: "text", required: true },
    { key: "license_scope", label: "Aree o siti per cui sei abilitato/a", type: "text", help: "Se l'abilitazione vale solo per certe zone." },
    { ...INS_COMPANY, label: "Assicurazione di responsabilità civile: compagnia" },
    INS_POLICY,
    INS_EXPIRY,
    { key: "group_max", label: "Gruppo più grande che puoi seguire", type: "number" },
  ],
  autista: [
    {
      key: "auth_type",
      label: "Tipo di servizio",
      type: "select",
      required: true,
      options: ["Noleggio con conducente (NCC)", "Taxi", "Autobus / granturismo", "Transfer privato", "Altro"],
    },
    { key: "auth_body", label: "Ente che ha rilasciato l'autorizzazione", type: "text", required: true, placeholder: "Es. Comune di Roma" },
    { key: "auth_number", label: "Numero dell'autorizzazione o della licenza", type: "text", required: true },
    { key: "vehicle_types", label: "Mezzi a disposizione", type: "chips", required: true, options: ["Auto", "Berlina di lusso", "Van", "Minibus", "Bus", "4x4"] },
    { key: "max_seats", label: "Posti del mezzo più grande", type: "number", required: true },
    { key: "vehicles_count", label: "Quanti mezzi hai", type: "number" },
    { ...INS_COMPANY, label: "Assicurazione dei passeggeri: compagnia" },
    INS_POLICY,
    INS_EXPIRY,
  ],
  struttura: [
    {
      key: "structure_type",
      label: "Tipo di struttura",
      type: "select",
      required: true,
      options: ["Hotel", "B&B", "Resort", "Agriturismo", "Appartamenti", "Lodge / campo tendato", "Ostello", "Altro"],
    },
    { key: "structure_location", label: "Dove si trova la struttura (città e paese)", type: "text", required: true },
    { key: "structure_code", label: "Codice identificativo o licenza della struttura", type: "text", required: true, help: "In Italia il CIN; all'estero la licenza locale." },
    { key: "category", label: "Categoria", type: "text", placeholder: "Es. 4 stelle" },
    { key: "rooms", label: "Numero di camere", type: "number", required: true },
    { key: "ins_company", label: "Assicurazione (compagnia)", type: "text" },
    { key: "ins_policy", label: "Numero di polizza", type: "text" },
    { key: "ins_expiry", label: "Scadenza della polizza", type: "date" },
  ],
  esperienze: [
    {
      key: "activity_type",
      label: "Tipo di attività",
      type: "select",
      required: true,
      options: ["Escursioni e trekking", "Cucina e degustazioni", "Subacquea e sport acquatici", "Safari e natura", "Arte e artigianato", "Sport e avventura", "Benessere", "Altro"],
    },
    { key: "license_number", label: "Licenza o abilitazione, se prevista dalla tua attività", type: "text" },
    { ...INS_COMPANY, label: "Assicurazione di responsabilità civile: compagnia" },
    INS_POLICY,
    INS_EXPIRY,
    { key: "group_max", label: "Persone al massimo per gruppo", type: "number", required: true },
    { key: "duration", label: "Durata tipica", type: "text", placeholder: "Es. mezza giornata" },
  ],
  altro: [
    { key: "other_service", label: "Che servizio offri", type: "textarea", required: true },
    { key: "license_number", label: "Licenza o registro, se previsti", type: "text" },
  ],
};

// Argomenti tra cui scegliere (compaiono come etichette nell'elenco)
export const KIND_SPECIALTIES: Record<BusinessKind, string[]> = {
  agenzia: ["Viaggi di nozze", "Famiglie", "Gruppi", "Lusso", "Viaggi su misura", "Crociere", "Viaggi culturali", "Avventura"],
  tour_operator: ["Pacchetti di gruppo", "Tour di gruppo", "Lusso", "Viaggi su misura", "Mare", "Culturali", "Avventura", "Crociere"],
  dmc: ["Gruppi", "Incentive e congressi", "Su misura", "Lusso", "Natura e avventura", "Culturali"],
  guida: ["Arte e storia", "Archeologia", "Natura e trekking", "Fotografia", "Gastronomia", "Famiglie e bambini", "Religioni e spiritualità", "Avventura"],
  autista: ["Aeroporto", "Tour di più giorni", "Lusso", "Gruppi", "Accessibilità", "Famiglie"],
  struttura: ["Lusso", "Charme", "Famiglie", "Mare", "Natura", "Città", "Gruppi", "Benessere"],
  esperienze: ["Famiglie", "Gruppi", "Privato", "Natura", "Cultura", "Gastronomia", "Sport", "Benessere"],
  altro: [],
};

// Documenti che potremmo chiederti in fase di verifica
export const KIND_DOCS: Record<BusinessKind, string[]> = {
  agenzia: ["Visura camerale o partita IVA", "Autorizzazione o SCIA all'esercizio", "Polizza di responsabilità civile professionale", "Garanzia per insolvenza o fallimento, se vendi pacchetti"],
  tour_operator: ["Visura camerale o partita IVA", "Autorizzazione o SCIA all'esercizio", "Polizza di responsabilità civile professionale", "Garanzia per insolvenza o fallimento"],
  dmc: ["Visura o registro dell'attività nel paese in cui operi", "Licenza locale", "Polizza di responsabilità civile"],
  guida: ["Documento di abilitazione o iscrizione", "Partita IVA o equivalente nel tuo paese", "Polizza di responsabilità civile"],
  autista: ["Autorizzazione NCC, taxi o licenza trasporto", "Partita IVA o equivalente nel tuo paese", "Polizza di assicurazione dei passeggeri"],
  struttura: ["Licenza o codice identificativo della struttura", "Partita IVA o equivalente nel tuo paese", "Polizza di assicurazione, se presente"],
  esperienze: ["Partita IVA o equivalente nel tuo paese", "Licenza o abilitazione, se prevista", "Polizza di responsabilità civile"],
  altro: ["Partita IVA o equivalente nel tuo paese", "Eventuale licenza"],
};

export const LANGUAGES = ["Italiano", "Inglese", "Francese", "Spagnolo", "Tedesco", "Portoghese", "Arabo", "Russo", "Cinese", "Giapponese", "Turco", "Greco"];

export const LEGAL_FORMS = ["Ditta individuale", "Libero professionista", "Società a responsabilità limitata", "Società per azioni", "Società di persone", "Cooperativa", "Associazione", "Altro"];

// Paesi dell'Unione Europea (la partita IVA si controlla in modo diverso)
export const EU_COUNTRIES = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
