// Bonus di benvenuto: nei primi 30 giorni dalla registrazione i professionisti usano Zefiro con il pacchetto
// «Plus» in regalo (budget giornaliero più ampio). Si calcola dalla data di registrazione: nessun dato da salvare.
// Solo per chi usa il gestionale come professionista (non per viaggiatori e clienti).

export const WELCOME_DAYS = 30;
export const WELCOME_PLAN = "plus" as const;

type PlanId = "start" | "plus" | "pro";
const RANK: Record<PlanId, number> = { start: 0, plus: 1, pro: 2 };

export type WelcomeBonus = { daysLeft: number; until: Date; plan: PlanId };

export function welcomeBonus(createdAt: string | null | undefined, now: Date = new Date()): WelcomeBonus | null {
  if (!createdAt) return null;
  const start = new Date(createdAt).getTime();
  if (!Number.isFinite(start)) return null;
  const until = new Date(start + WELCOME_DAYS * 24 * 60 * 60 * 1000);
  const left = until.getTime() - now.getTime();
  if (left <= 0) return null;
  return { daysLeft: Math.ceil(left / (24 * 60 * 60 * 1000)), until, plan: WELCOME_PLAN };
}

// Il pacchetto che vale davvero: quello scelto, oppure quello del bonus se è più ampio
export function effectivePlan(chosen: PlanId, bonus: WelcomeBonus | null): PlanId {
  return bonus && RANK[bonus.plan] > RANK[chosen] ? bonus.plan : chosen;
}
