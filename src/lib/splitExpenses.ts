// Spese divise tra amici: chi ha pagato cosa, quanto spetta a ciascuno e chi deve dare soldi a chi.
// Tutto in centesimi (numeri interi), così non ci sono errori di arrotondamento.

export type Person = { id: string; name: string };
export type Expense = { id: string; amount: number; paid_by: string; shared_with: string[]; category: string };
export type Settlement = { from: string; to: string; cents: number };

const toCents = (euro: number) => Math.round(euro * 100);

// Divide una cifra tra più persone: i centesimi che avanzano vanno alle prime
export function splitCents(total: number, ids: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const base = Math.floor(total / ids.length);
  let rest = total - base * ids.length;
  for (const id of ids) {
    out.set(id, base + (rest > 0 ? 1 : 0));
    if (rest > 0) rest--;
  }
  return out;
}

// Saldo di ognuno: quanto ha pagato meno quanto gli spetta (positivo = deve ricevere)
export function balances(people: Person[], expenses: Expense[]) {
  const paid = new Map<string, number>(people.map((p) => [p.id, 0]));
  const owed = new Map<string, number>(people.map((p) => [p.id, 0]));
  for (const e of expenses) {
    const cents = toCents(e.amount);
    paid.set(e.paid_by, (paid.get(e.paid_by) ?? 0) + cents);
    const sharers = e.shared_with.filter((id) => owed.has(id));
    const parts = splitCents(cents, sharers.length ? sharers : [e.paid_by]);
    for (const [id, share] of parts) owed.set(id, (owed.get(id) ?? 0) + share);
  }
  return people.map((p) => ({ id: p.id, name: p.name, paid: paid.get(p.id) ?? 0, owed: owed.get(p.id) ?? 0, balance: (paid.get(p.id) ?? 0) - (owed.get(p.id) ?? 0) }));
}

// Pochi pagamenti per pareggiare i conti: chi deve di più paga a chi deve ricevere di più
export function settle(rows: { id: string; balance: number }[]): Settlement[] {
  const debtors = rows.filter((r) => r.balance < 0).map((r) => ({ id: r.id, left: -r.balance })).sort((a, b) => b.left - a.left);
  const creditors = rows.filter((r) => r.balance > 0).map((r) => ({ id: r.id, left: r.balance })).sort((a, b) => b.left - a.left);
  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].left, creditors[j].left);
    if (pay > 0) out.push({ from: debtors[i].id, to: creditors[j].id, cents: pay });
    debtors[i].left -= pay;
    creditors[j].left -= pay;
    if (debtors[i].left === 0) i++;
    if (creditors[j].left === 0) j++;
  }
  return out;
}

export const euroFromCents = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
