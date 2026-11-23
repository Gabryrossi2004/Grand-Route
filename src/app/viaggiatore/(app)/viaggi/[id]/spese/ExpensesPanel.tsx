"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserPlus, X } from "lucide-react";
import { Bars } from "@/components/StatsCharts";
import { addTripExpense, addTripPerson, deleteTripExpense, removeTripPerson, setTripBudget } from "@/app/viaggiatore/tripActions";
import { balances, euroFromCents, settle } from "@/lib/splitExpenses";

export type PersonRow = { id: string; name: string };
export type ExpenseRow = { id: string; description: string; amount: number; category: string; paid_by: string; shared_with: string[]; expense_date: string | null; created_at: string };

const CATEGORIES = ["Alloggio", "Cibo", "Trasporti", "Attività", "Shopping", "Altro"];
const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";
const euro = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export default function ExpensesPanel({
  tripId,
  notReady,
  people,
  expenses,
  budget,
  budgetReady,
  myName,
}: {
  tripId: string;
  notReady: boolean;
  people: PersonRow[];
  expenses: ExpenseRow[];
  budget: number | null;
  budgetReady: boolean;
  myName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newPerson, setNewPerson] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[1]);
  const [paidBy, setPaidBy] = useState("");
  const [shared, setShared] = useState<string[] | null>(null); // null = tutti
  const [date, setDate] = useState("");
  const [budgetText, setBudgetText] = useState(budget !== null ? String(budget) : "");

  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const rows = useMemo(
    () => balances(people, expenses.map((e) => ({ id: e.id, amount: e.amount, paid_by: e.paid_by, shared_with: e.shared_with, category: e.category }))),
    [people, expenses],
  );
  const settlements = useMemo(() => settle(rows), [rows]);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  }, [expenses]);

  if (notReady) {
    return <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per usare le spese serve l&apos;aggiornamento del database (migrazione 0059, Supabase → SQL Editor).</p>;
  }

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, then?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else {
        then?.();
        router.refresh();
      }
    });
  }

  const payer = paidBy || people[0]?.id || "";
  const sharedIds = shared ?? people.map((p) => p.id);

  function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!description.trim() || !(value > 0) || !payer || sharedIds.length === 0) {
      setError("Scrivi cosa hai pagato, l'importo e tra chi si divide.");
      return;
    }
    run(
      () => addTripExpense(tripId, { description: description.trim(), amount: value, category, paidBy: payer, sharedWith: sharedIds, date: date || null }),
      () => {
        setDescription("");
        setAmount("");
        setShared(null);
        setDate("");
      },
    );
  }

  const spentPct = budget && budget > 0 ? Math.min(100, (total / budget) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
        <h2 className="mb-1 font-semibold text-[#233c5e]">Chi viaggia</h2>
        <p className="mb-3 text-sm text-slate-600">Aggiungi te e gli amici (bastano i nomi): serve per dividere le spese.</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {people.map((p) => (
            <span key={p.id} className="flex items-center gap-1 rounded-full border border-[#e6d7bb] bg-[#faf3e6] py-1 pl-3 pr-1.5 text-sm text-[#233c5e]">
              {p.name}
              <button type="button" aria-label={`Togli ${p.name}`} onClick={() => run(() => removeTripPerson(tripId, p.id))} className="rounded-full p-0.5 text-slate-400 hover:text-red-600">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newPerson.trim()) return;
            run(() => addTripPerson(tripId, newPerson), () => setNewPerson(""));
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} maxLength={40} placeholder="Nome (es. Marco)" className={`${field} min-w-0 flex-1 sm:max-w-xs`} />
          <button type="submit" disabled={pending || !newPerson.trim()} className="flex items-center gap-1 rounded-full border border-[#233c5e] px-4 py-2 text-sm font-semibold text-[#233c5e] hover:bg-[#233c5e] hover:text-white disabled:opacity-50">
            <UserPlus size={14} /> Aggiungi
          </button>
          {people.length === 0 && myName && (
            <button type="button" disabled={pending} onClick={() => run(() => addTripPerson(tripId, myName))} className="rounded-full px-3 py-2 text-sm font-medium text-[#233c5e] underline">
              Aggiungi me ({myName})
            </button>
          )}
        </form>
      </section>

      {people.length > 0 && (
        <form onSubmit={submitExpense} className="flex flex-col gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <h2 className="font-semibold text-[#233c5e]">Nuova spesa</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="Cosa (es. Cena al ristorante)" className={field} />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Importo in € (es. 84,50)" className={field} />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria" className={field}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select value={payer} onChange={(e) => setPaidBy(e.target.value)} aria-label="Chi ha pagato" className={field}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  Ha pagato {p.name}
                </option>
              ))}
            </select>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Giorno" className={field} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Si divide tra:</p>
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => {
                const on = sharedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setShared(on ? sharedIds.filter((x) => x !== p.id) : [...sharedIds, p.id])}
                    className={`rounded-full border px-3 py-1 text-sm ${on ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-slate-500"}`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="submit" disabled={pending} className="flex w-fit items-center gap-1 rounded-full bg-[#233c5e] px-5 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60">
            <Plus size={14} /> Aggiungi la spesa
          </button>
        </form>
      )}
      {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>}

      {expenses.length > 0 && (
        <>
          <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
            <h2 className="mb-1 font-semibold text-[#233c5e]">Chi deve dare soldi a chi</h2>
            {settlements.length === 0 ? (
              <p className="text-sm text-slate-600">Siete pari: nessuno deve niente a nessuno.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {settlements.map((s, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#faf3e6] px-3 py-2 text-slate-800">
                    <strong>{nameOf.get(s.from)}</strong> dà <strong className="text-[#233c5e]">{euroFromCents(s.cents)}</strong> a <strong>{nameOf.get(s.to)}</strong>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Persona</th>
                    <th className="py-1 pr-3 font-medium">Ha pagato</th>
                    <th className="py-1 pr-3 font-medium">Gli spetta</th>
                    <th className="py-1 font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-[#f4ecdb]">
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{r.name}</td>
                      <td className="py-1.5 pr-3">{euroFromCents(r.paid)}</td>
                      <td className="py-1.5 pr-3">{euroFromCents(r.owed)}</td>
                      <td className={`py-1.5 font-medium ${r.balance > 0 ? "text-emerald-700" : r.balance < 0 ? "text-red-600" : "text-slate-500"}`}>
                        {r.balance > 0 ? "+" : ""}
                        {euroFromCents(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
              <h2 className="mb-1 font-semibold text-[#233c5e]">Totale: {euro(total)}</h2>
              <p className="mb-3 text-xs text-slate-500">{people.length > 0 ? `Circa ${euro(total / people.length)} a testa.` : ""}</p>
              <Bars rows={byCategory} format={(n) => euro(n)} />
            </section>
            {budgetReady && (
              <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
                <h2 className="mb-1 font-semibold text-[#233c5e]">Budget</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = budgetText.trim() === "" ? null : Number(budgetText.replace(",", "."));
                    if (v !== null && !(v >= 0)) return setError("Scrivi un importo valido.");
                    run(() => setTripBudget(tripId, v));
                  }}
                  className="flex gap-2"
                >
                  <input value={budgetText} onChange={(e) => setBudgetText(e.target.value)} inputMode="decimal" placeholder="Budget totale in €" className={`${field} min-w-0 flex-1`} />
                  <button type="submit" disabled={pending} className="rounded-full border border-[#233c5e] px-4 py-2 text-sm font-semibold text-[#233c5e] hover:bg-[#233c5e] hover:text-white disabled:opacity-60">
                    Salva
                  </button>
                </form>
                {budget !== null && budget > 0 && (
                  <>
                    <div className="mt-3 h-2.5 rounded-full bg-[#f1ead9]">
                      <div className={`h-2.5 rounded-full ${total > budget ? "bg-red-500" : "bg-emerald-600"}`} style={{ width: `${spentPct}%` }} />
                    </div>
                    <p className="mt-1.5 text-sm text-slate-700">
                      {total > budget ? (
                        <>
                          Sforato di <strong className="text-red-600">{euro(total - budget)}</strong>
                        </>
                      ) : (
                        <>
                          Ti restano <strong>{euro(budget - total)}</strong> su {euro(budget)}
                        </>
                      )}
                    </p>
                  </>
                )}
              </section>
            )}
          </div>

          <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
            <h2 className="mb-2 font-semibold text-[#233c5e]">Le spese</h2>
            <ul className="flex flex-col">
              {expenses.map((e) => (
                <li key={e.id} className="group flex items-start gap-3 border-b border-[#f4ecdb] py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{e.description}</p>
                    <p className="text-xs text-slate-500">
                      {e.category} · pagato da {nameOf.get(e.paid_by) ?? "?"} · tra {e.shared_with.length === people.length ? "tutti" : e.shared_with.map((id) => nameOf.get(id) ?? "?").join(", ")}
                      {e.expense_date ? ` · ${new Date(`${e.expense_date}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-[#233c5e]">{euro(e.amount)}</span>
                  <button
                    type="button"
                    aria-label={`Elimina ${e.description}`}
                    onClick={() => {
                      if (window.confirm(`Eliminare «${e.description}»?`)) run(() => deleteTripExpense(tripId, e.id));
                    }}
                    className="text-slate-300 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
