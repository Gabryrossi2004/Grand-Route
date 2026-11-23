import Link from "next/link";
import { Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { levelFor, parseLevels, pointsFrom } from "@/lib/benefits";
import { addAdjustment, deleteAdjustment } from "@/app/dashboard/settings/vantaggi/actions";
import SubmitButton from "@/components/SubmitButton";
import ConfirmDeleteButton from "@/components/community/ConfirmDeleteButton";

type Adj = { id: string; points: number; reason: string; created_at: string };

// Punti fedeltà del cliente (scheda cliente dell'agenzia): calcolati dai pagamenti incassati + bonus
export default async function ClientLoyaltyCard({ clientId, ownerId }: { clientId: string; ownerId: string }) {
  const supabase = await createClient();
  const [{ data: loyalty, error }, { data: tripRows }, { data: adjRows }] = await Promise.all([
    supabase.from("agency_loyalty").select("enabled, euros_per_point, levels").eq("owner_id", ownerId).maybeSingle(),
    supabase.from("trips").select("id").eq("client_id", clientId).eq("owner_id", ownerId),
    supabase.from("loyalty_adjustments").select("id, points, reason, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (error || !loyalty?.enabled) {
    return (
      <section className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/60 p-4 text-sm text-slate-600">
        <Gift size={16} className="mr-1 inline text-[#c58f2d]" /> Premia i clienti fedeli con punti e offerte riservate:{" "}
        <Link href="/dashboard/settings/vantaggi" className="font-medium text-[#233c5e] underline">
          attiva i vantaggi per i clienti
        </Link>
        .
      </section>
    );
  }
  const tripIds = ((tripRows as { id: string }[] | null) ?? []).map((t) => t.id);
  const { data: paidRows } = tripIds.length
    ? await supabase.from("trip_payments").select("amount").in("trip_id", tripIds).eq("direction", "incasso").not("paid_date", "is", null)
    : { data: [] };
  const paid = ((paidRows as { amount: number }[] | null) ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const adjs = (adjRows as Adj[] | null) ?? [];
  const bonus = adjs.reduce((s, a) => s + a.points, 0);
  const points = pointsFrom(paid, Number(loyalty.euros_per_point), bonus);
  const { current, next } = levelFor(points, parseLevels(loyalty.levels));
  const input = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#cda876]";

  return (
    <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Gift size={18} className="text-[#c58f2d]" /> Punti fedeltà
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        <strong className="text-2xl text-[#233c5e]">{points}</strong> punti{current ? ` · livello «${current.name}»` : ""}
        {next ? <span className="text-slate-500"> · mancano {next.min - points} punti per «{next.name}»</span> : null}
      </p>
      <p className="text-xs text-slate-500">
        {Math.floor(paid / Number(loyalty.euros_per_point || 10))} dai pagamenti incassati ({paid.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}) e {bonus >= 0 ? `+${bonus}` : bonus} da bonus e premi.
      </p>
      <form action={addAdjustment.bind(null, clientId)} className="mt-3 flex flex-wrap items-center gap-2">
        <select name="kind" className={input} defaultValue="bonus" aria-label="Tipo">
          <option value="bonus">Aggiungi bonus</option>
          <option value="usa">Usa punti (premio)</option>
        </select>
        <input name="points" type="number" min="1" required placeholder="Punti" className={`${input} w-24`} />
        <input name="reason" required maxLength={200} placeholder="Motivo (es. ha presentato un amico)" className={`${input} min-w-0 flex-1`} />
        <SubmitButton pendingLabel="…" className="rounded-lg bg-[#233c5e] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
          Registra
        </SubmitButton>
      </form>
      {adjs.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {adjs.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>
                <strong className={a.points > 0 ? "text-emerald-700" : "text-red-600"}>{a.points > 0 ? `+${a.points}` : a.points}</strong> {a.reason}
                <span className="text-xs text-slate-400"> · {new Date(a.created_at).toLocaleDateString("it-IT")}</span>
              </span>
              <ConfirmDeleteButton action={deleteAdjustment.bind(null, clientId, a.id)} confirmText="Annullare questo movimento di punti?" label="Annulla" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
