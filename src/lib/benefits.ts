// Programma fedeltà dell'agenzia: livelli e calcolo dei punti (condiviso tra agenzia e cliente).

export type LoyaltyLevel = { name: string; min: number; perks: string };

export const DEFAULT_LEVELS: LoyaltyLevel[] = [
  { name: "Viaggiatore", min: 0, perks: "Assistenza dedicata in chat e numero per le emergenze durante il viaggio." },
  { name: "Esploratore", min: 300, perks: "Priorità sulle offerte riservate e check-in seguito dall'agenzia." },
  { name: "Giramondo", min: 1000, perks: "Un servizio in omaggio o uno sconto sul prossimo viaggio, deciso con l'agenzia." },
];

export function parseLevels(raw: unknown): LoyaltyLevel[] {
  if (!Array.isArray(raw)) return DEFAULT_LEVELS;
  const list = raw
    .map((l) => ({
      name: String((l as LoyaltyLevel)?.name ?? "").trim().slice(0, 40),
      min: Math.max(0, Math.floor(Number((l as LoyaltyLevel)?.min) || 0)),
      perks: String((l as LoyaltyLevel)?.perks ?? "").trim().slice(0, 300),
    }))
    .filter((l) => l.name);
  return list.length ? list.sort((a, b) => a.min - b.min) : DEFAULT_LEVELS;
}

export function pointsFrom(paid: number, eurosPerPoint: number, bonus: number) {
  const rate = eurosPerPoint > 0 ? eurosPerPoint : 10;
  return Math.max(0, Math.floor((Number(paid) || 0) / rate) + (Number(bonus) || 0));
}

export function levelFor(points: number, levels: LoyaltyLevel[]) {
  let current: LoyaltyLevel | null = null;
  let next: LoyaltyLevel | null = null;
  for (const l of levels) {
    if (points >= l.min) current = l;
    else if (!next) next = l;
  }
  return { current, next };
}
