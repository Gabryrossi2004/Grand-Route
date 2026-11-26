// «Per iniziare»: le voci della lista di benvenuto, diverse per ogni tipo di account.
// Si spuntano da sole guardando cosa l'utente ha già fatto (dati calcolati da onboarding_status, migrazione 0072).
export type OnboardingStatus = {
  hidden: boolean;
  logo: boolean;
  trips: number;
  published: number;
  clients: number;
  ai: boolean;
  collabs: number;
  orders: number;
  showcase: boolean;
  listed: boolean;
  agenda: boolean;
  packing: boolean;
  expenses: boolean;
  push: boolean;
  client_details: boolean;
};

// done: true/false = voce da spuntare; null = semplice suggerimento (non si può sapere se l'ha fatto)
export type OnboardingStep = { key: string; label: string; hint: string; href: string; done: boolean | null };

export const agencySteps = (s: OnboardingStatus): OnboardingStep[] => [
  { key: "logo", label: "Aggiungi il tuo logo", hint: "Compare sui viaggi e nelle email ai clienti.", href: "/dashboard/settings", done: s.logo },
  { key: "trip", label: "Crea il primo viaggio", hint: "A mano, oppure incolla un testo e lascia fare a Zefiro.", href: "/dashboard/trips/new", done: s.trips > 0 },
  { key: "ai", label: "Prova Zefiro", hint: "Genera un itinerario da una richiesta scritta in due righe.", href: "/dashboard/trips/new", done: s.ai },
  { key: "client", label: "Aggiungi un cliente", hint: "Con la sua scheda, i documenti e i viaggi.", href: "/dashboard/clients", done: s.clients > 0 },
  { key: "share", label: "Condividi un viaggio", hint: "Pubblica il viaggio e manda il link, o invialo al cliente.", href: "/dashboard", done: s.published > 0 },
  { key: "partner", label: "Scopri i Partner", hint: "Guide, autisti e strutture verificati: cerca e chiedi una collaborazione.", href: "/rete", done: s.collabs > 0 || s.orders > 0 },
];

export const supplierSteps = (s: OnboardingStatus): OnboardingStep[] => [
  { key: "showcase", label: "Completa la tua vetrina", hint: "Logo e una frase che ti presenta: le agenzie scelgono da qui.", href: "/rete/profilo", done: s.showcase },
  { key: "listed", label: "Fatti trovare dalle agenzie", hint: "Attiva la vetrina nella ricerca Partner.", href: "/rete/profilo", done: s.listed },
  { key: "agenda", label: "Prepara l'Agenda", hint: "Segna i giorni non disponibili, oppure mostra la disponibilità ai partner.", href: "/rete/agenda", done: s.agenda },
  { key: "collab", label: "Collega il primo partner", hint: "Accetta una richiesta o contatta un'agenzia.", href: "/rete/messaggi", done: s.collabs > 0 },
  { key: "order", label: "Ricevi il primo servizio", hint: "Quando un'agenzia ti ordina un servizio lo vedi qui e lo confermi con un tocco.", href: "/rete/lavori", done: s.orders > 0 },
];

export const travelerSteps = (s: OnboardingStatus): OnboardingStep[] => [
  { key: "trip", label: "Crea il tuo primo viaggio", hint: "Scegli un itinerario pronto o descrivilo a Zefiro.", href: "/viaggiatore/nuovo", done: s.trips > 0 },
  { key: "packing", label: "Prepara la valigia", hint: "Idee automatiche in base a clima e durata, da spuntare.", href: "/viaggiatore", done: s.packing },
  { key: "expenses", label: "Segna una spesa", hint: "Grand Route calcola chi deve dare soldi a chi.", href: "/viaggiatore", done: s.expenses },
  { key: "ai", label: "Prova Zefiro", hint: "Un itinerario su misura, fino a 5 al mese.", href: "/viaggiatore/nuovo", done: s.ai },
];

// Area clienti: i testi sono tradotti nella pagina (chiavi portal.start.*)
export const clientStepKeys = (s: OnboardingStatus): { key: "details" | "trip" | "globe"; done: boolean | null; href: string }[] => [
  { key: "details", done: s.client_details, href: "/client/documenti" },
  { key: "trip", done: null, href: "/client" },
  { key: "globe", done: null, href: "/client/mappamondo" },
];

export const progressOf = (steps: OnboardingStep[]) => {
  const tracked = steps.filter((x) => x.done !== null);
  const done = tracked.filter((x) => x.done).length;
  return { done, total: tracked.length, complete: tracked.length > 0 && done === tracked.length };
};
