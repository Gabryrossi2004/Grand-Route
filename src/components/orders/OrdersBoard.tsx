"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Receipt } from "lucide-react";
import Modal from "@/components/Modal";
import OrderCard from "@/components/orders/OrderCard";
import OrderForm from "@/components/orders/OrderForm";
import { createInvoiceDraft } from "@/lib/actions/orders";
import { billableBlock, fmtDate, fmtMoney, orderTotal, todayRome, waitingForMe, type OrderPartner, type OrderRow } from "@/lib/orders/shared";

function Section({ title, hint, children, count }: { title: string; hint?: string; children: React.ReactNode; count: number }) {
  if (count === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-[#233c5e]">
        {title} <span className="text-base font-normal text-slate-400">({count})</span>
      </h2>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      <div className="mt-3 grid grid-cols-1 gap-3">{children}</div>
    </section>
  );
}

// Servizi svolti da fatturare, raggruppati per cliente: si spuntano e si prepara la bozza
function BillableGroup({ buyer, name, orders }: { buyer: string; name: string; orders: OrderRow[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(orders.map((o) => o.id));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byCurrency = new Set(orders.filter((o) => sel.includes(o.id)).map((o) => o.currency));
  const total = orders.filter((o) => sel.includes(o.id)).reduce((s, o) => s + orderTotal(o), 0);
  const currency = orders[0]?.currency ?? "EUR";
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold text-[#233c5e]">{name}</p>
        <p className="text-sm text-slate-600">
          Selezionati: <strong>{sel.length}</strong> · {byCurrency.size > 1 ? "valute diverse" : fmtMoney(total, currency)} <span className="text-slate-400">+ IVA se dovuta</span>
        </p>
      </div>
      <ul className="mt-3 divide-y divide-[#f2e2c4]">
        {orders.map((o) => (
          <li key={o.id} className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              checked={sel.includes(o.id)}
              onChange={(e) => setSel((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))}
              className="h-4 w-4 rounded border-slate-300"
              aria-label={`Includi ${o.title}`}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
              <span className="text-slate-500">{fmtDate(o.service_date, { day: "numeric", month: "short" })}</span> · {o.phase === "penale" ? `Penale: ${o.title}` : o.title}
              {o.extras.some((e) => e.state === "accettata") && <span className="text-xs text-slate-500"> (con variazioni)</span>}
            </span>
            <span className="shrink-0 text-sm font-medium">{fmtMoney(orderTotal(o), o.currency)}</span>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={pending || sel.length === 0 || byCurrency.size > 1}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await createInvoiceDraft(buyer, sel);
            if (!r.ok) return setError(r.error);
            router.push(`/rete/fatture/${r.id}`);
          })
        }
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Receipt size={16} /> {pending ? "Preparo la bozza…" : "Prepara la fattura"}
      </button>
      {byCurrency.size > 1 && <p className="mt-2 text-xs text-slate-500">Servizi in valute diverse: fai una fattura per valuta.</p>}
    </div>
  );
}

export default function OrdersBoard({
  role,
  orders,
  me,
  partners,
  invoiceBase,
}: {
  role: "seller" | "buyer";
  orders: OrderRow[];
  me: string;
  partners: OrderPartner[];
  invoiceBase: string;
}) {
  const [creating, setCreating] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const today = todayRome();

  const groups = useMemo(() => {
    const mine = orders.filter((o) => o.role === role);
    const needsMe = (o: OrderRow) =>
      waitingForMe(o, me) ||
      (role === "seller" && !o.invoice_id && o.extras.some((e) => e.state === "contestata")) ||
      (role === "buyer" && !o.invoice_id && o.extras.some((e) => e.state === "proposta" && e.created_by !== me));
    const action = mine.filter(needsMe);
    const actionIds = new Set(action.map((o) => o.id));
    const upcoming = mine
      .filter((o) => !actionIds.has(o.id) && (o.phase === "confermato" || o.phase === "da_confermare"))
      .sort((a, b) => a.service_date.localeCompare(b.service_date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    const billable = mine.filter((o) => !actionIds.has(o.id) && (o.phase === "svolto" || o.phase === "penale") && !billableBlock(o));
    const doneWaiting = mine.filter((o) => !actionIds.has(o.id) && (o.phase === "svolto" || o.phase === "penale") && !!billableBlock(o) && o.phase !== "penale");
    const archive = mine.filter((o) => ["fatturato", "annullato", "rifiutato"].includes(o.phase) && !actionIds.has(o.id));
    return { action, upcoming, billable, doneWaiting, archive, mine };
  }, [orders, role, me]);

  const billableByBuyer = useMemo(() => {
    const m = new Map<string, { name: string; orders: OrderRow[] }>();
    for (const o of groups.billable) {
      const g = m.get(o.counterpart) ?? { name: o.counterpart_name, orders: [] };
      g.orders.push(o);
      m.set(o.counterpart, g);
    }
    return [...m.entries()];
  }, [groups.billable]);

  const upcomingTotal = groups.upcoming.reduce((s, o) => s + (o.currency === "EUR" ? orderTotal(o) : 0), 0);
  const billableTotal = groups.billable.reduce((s, o) => s + (o.currency === "EUR" ? orderTotal(o) : 0), 0);
  const thisWeek = groups.upcoming.filter((o) => o.service_date <= new Date(Date.parse(`${today}T12:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10)).length;

  const card = (o: OrderRow) => <OrderCard key={o.id} order={o} me={me} invoiceBase={invoiceBase} defaultOpen={groups.action.some((x) => x.id === o.id)} />;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="grid w-full min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Da gestire", String(groups.action.length), groups.action.length > 0 ? "text-[#c0392b]" : "text-[#233c5e]"],
            ["Nei prossimi 7 giorni", String(thisWeek), "text-[#233c5e]"],
            ["In programma", fmtMoney(upcomingTotal), "text-[#233c5e]"],
            [role === "seller" ? "Da fatturare" : "Svolti da fatturare", fmtMoney(billableTotal), "text-emerald-700"],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-xl border border-[#e6d7bb] bg-white px-3 py-2">
              <p className={`text-lg font-semibold ${c}`}>{v}</p>
              <p className="text-xs text-slate-500">{l}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setCreating(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f]">
          <Plus size={16} /> {role === "seller" ? "Registra un servizio" : "Nuovo ordine"}
        </button>
      </div>

      {groups.mine.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-8 text-center text-slate-600">
          <FileText className="mx-auto mb-2 text-[#c58f2d]" />
          {role === "seller" ? (
            <p>Qui arrivano gli ordini dei tuoi clienti (agenzie e tour operator partner). Puoi anche registrare tu un servizio: il cliente lo conferma, e quando è svolto lo trovi pronto da fatturare.</p>
          ) : (
            <p>Qui trovi gli ordini ai tuoi fornitori partner. Puoi crearli da qui o dal viaggio (Servizi e fornitori): il fornitore conferma, il giorno dopo il servizio risulta svolto e la fattura ti arriva già collegata.</p>
          )}
        </div>
      )}

      <Section title="Da gestire" hint={role === "seller" ? "Ordini da confermare e variazioni contestate." : "Ordini da confermare e variazioni da accettare o contestare."} count={groups.action.length}>
        {groups.action.map(card)}
      </Section>

      {role === "seller" && (
        <Section title="Pronti da fatturare" hint="Servizi svolti (e penali): scegli quali mettere in fattura. La bozza si compila da sola." count={billableByBuyer.length}>
          {billableByBuyer.map(([buyer, g]) => (
            <BillableGroup key={buyer} buyer={buyer} name={g.name} orders={g.orders} />
          ))}
        </Section>
      )}

      <Section title="In programma" hint="Il giorno dopo la data, ogni servizio diventa «svolto» da solo." count={groups.upcoming.length}>
        {groups.upcoming.map(card)}
      </Section>

      {role === "buyer" && (
        <Section title="Svolti, in attesa di fattura" count={groups.billable.length + groups.doneWaiting.length}>
          {[...groups.billable, ...groups.doneWaiting].map(card)}
        </Section>
      )}
      {role === "seller" && (
        <Section title="Svolti, non ancora fatturabili" hint="Hanno variazioni in attesa o contestate." count={groups.doneWaiting.length}>
          {groups.doneWaiting.map(card)}
        </Section>
      )}

      {groups.archive.length > 0 && (
        <div className="mt-8">
          <button type="button" onClick={() => setShowArchive((v) => !v)} className="text-sm font-medium text-[#233c5e] underline">
            {showArchive ? "Nascondi" : "Mostra"} fatturati, annullati e rifiutati ({groups.archive.length})
          </button>
          {showArchive && <div className="mt-3 grid grid-cols-1 gap-3">{groups.archive.map(card)}</div>}
        </div>
      )}

      {creating && (
        <Modal title={role === "seller" ? "Registra un servizio" : "Nuovo ordine a un fornitore"} onClose={() => setCreating(false)} wide>
          <OrderForm mode="create" role={role} partners={partners} onDone={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
