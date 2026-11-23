// Libreria Grand Route dell'Italia: 20 regioni, ognuna con le sue zone ("sottocartelle"),
// per i tour operator di incoming. Testi scritti a mano, senza costi di AI.
import nordOvest from "@/data/italia/nord-ovest.json";
import nordEst from "@/data/italia/nord-est.json";
import centro from "@/data/italia/centro.json";
import sud from "@/data/italia/sud.json";
import isole from "@/data/italia/isole.json";

export type ItalyPlace = { name: string; description: string; search: string };
export type ItalyZone = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tagline: string;
  description: string[];
  highlights: ItalyPlace[];
  experiences: string[];
  idealFor: string;
  bestPeriod: string;
};
export type ItalyRegion = {
  name: string;
  tagline: string;
  description: string[];
  facts: { capoluogo: string; aeroporti: string; comeArrivare: string; periodo: string; clima: string; unesco: string; prodotti: string };
  places: ItalyPlace[];
  experiences: string[];
  food: string[];
  gettingAround: string[];
  tips: string[];
  zones: ItalyZone[];
  // Itinerari proposti per la regione (notti tra parentesi nel percorso)
  itineraries?: { title: string; days: number; route: string; description: string }[];
};

export const ITALY_REGIONS = { ...nordOvest, ...nordEst, ...centro, ...sud, ...isole } as unknown as Record<string, ItalyRegion>;

// da nord a sud, come nelle carte
export const ITALY_ORDER = [
  "valle-d-aosta", "piemonte", "lombardia", "trentino-alto-adige", "veneto", "friuli-venezia-giulia", "liguria", "emilia-romagna",
  "toscana", "umbria", "marche", "lazio", "abruzzo", "molise", "campania", "puglia", "basilicata", "calabria", "sicilia", "sardegna",
];

export const ITALY_FACT_LABELS: { key: keyof ItalyRegion["facts"]; label: string }[] = [
  { key: "capoluogo", label: "Capoluogo" },
  { key: "aeroporti", label: "Aeroporti" },
  { key: "comeArrivare", label: "Come arrivare" },
  { key: "periodo", label: "Periodo migliore" },
  { key: "clima", label: "Clima" },
  { key: "unesco", label: "Patrimonio UNESCO" },
  { key: "prodotti", label: "Prodotti tipici e vini" },
];
