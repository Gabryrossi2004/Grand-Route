// Guide paese della libreria Grand Route: approfondimenti per l'agente che si aggiungono alle schede base.
import type { CountrySheetContent } from "@/lib/countrySheetAi";
import asia from "./guide-asia.json";
import africaMo from "./guide-africa-medioriente.json";
import americheOc from "./guide-americhe-oceania.json";
import europa from "./guide-europa.json";
import europa2 from "./guide-europa-2.json";
import europa3 from "./guide-europa-3.json";
import medioAsiaC from "./guide-medioriente-asiacentrale.json";
import asia2 from "./guide-asia-2.json";
import africa2 from "./guide-africa-2.json";
import africa4 from "./guide-africa-4.json";
import africa3 from "./guide-africa-3.json";
import americhe2 from "./guide-americhe-2.json";
import caraibi from "./guide-caraibi.json";
import oceania2 from "./guide-oceania-2.json";

export type CountryGuide = {
  moreDescription?: string[];
  morePlaces?: CountrySheetContent["places"];
  bestPeriod?: string;
  areas: NonNullable<CountrySheetContent["areas"]>;
  experiences: NonNullable<CountrySheetContent["experiences"]>;
  itineraries: NonNullable<CountrySheetContent["itineraries"]>;
  agentTips: string[];
};

const FILES: Record<string, unknown>[] = [asia, africaMo, americheOc, europa, europa2, europa3, medioAsiaC, asia2, africa2, africa4, africa3, americhe2, caraibi, oceania2];

export const COUNTRY_GUIDES = Object.assign({}, ...FILES) as Record<string, CountryGuide>;
