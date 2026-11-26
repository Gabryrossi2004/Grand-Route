import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileMinus } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import InvoiceEditor from "@/components/orders/InvoiceEditor";
import InvoiceView from "@/components/orders/InvoiceView";
import InvoiceActions from "@/components/orders/InvoiceActions";
import { computeTotals, type InvoiceDoc } from "@/lib/invoicing/engine";
import { INVOICE_STATUS, fmtDate, fmtMoney, todayRome } from "@/lib/orders/shared";

type Row = {
  id: string; seller_id: string; buyer_id: string; status: "bozza" | "emessa" | "pagata" | "stornata"; number: string | null;
  issue_date: string | null; due_date: string | null; currency: string; doc: InvoiceDoc; paid_at: string | null; void_note: string | null;
  doc_type?: string; credit_of?: string | null; credit_full?: boolean; reminders_sent?: number;
};

// Una fattura (o nota di credito): il fornitore la prepara e la emette; il cliente la vede da emessa in poi.
export default async function InvoicePage({ id, backHref, backLabel }: { id: string; backHref: string; backLabel: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getCachedUser();
  if (!user) redirect("/professionisti");
  const supabase = await createClient();
  const { data } = await supabase.from("network_invoices").select("*").eq("id", id).maybeSingle();
  const inv = data as Row | null;
  if (!inv) notFound();
  const role = inv.seller_id === user.id ? "seller" : "buyer";
  const credit = inv.doc_type === "TD04";
  const base = backHref.startsWith("/dashboard") ? "/dashboard/ordini/fatture" : "/rete/fatture";

  // Fattura collegata (per la nota di credito) e note di credito della fattura
  const [{ data: linkedRow }, { data: creditRows }] = await Promise.all([
    credit && inv.credit_of ? supabase.from("network_invoices").select("id, number, issue_date").eq("id", inv.credit_of).maybeSingle() : Promise.resolve({ data: null }),
    !credit ? supabase.from("network_invoices").select("id, number, issue_date, netto, status, credit_full").eq("credit_of", inv.id).neq("status", "bozza") : Promise.resolve({ data: null }),
  ]);
  const linked = linkedRow as { id: string; number: string | null; issue_date: string | null } | null;
  const credits = (creditRows ?? []) as { id: string; number: string; issue_date: string; netto: number; status: string; credit_full: boolean }[];
  let draftCredits: { id: string }[] = [];
  if (!credit && role === "seller") {
    const { data: d } = await supabase.from("network_invoices").select("id").eq("credit_of", inv.id).eq("status", "bozza");
    draftCredits = (d ?? []) as { id: string }[];
  }

  const st = INVOICE_STATUS[inv.status];
  const t = computeTotals(inv.doc);
  const partialCredits = credits.filter((c) => c.status === "emessa" && !c.credit_full).reduce((s, c) => s + Number(c.netto), 0);
  const residuo = Math.max(0, Math.round((t.netto - partialCredits) * 100) / 100);
  let bolloCharge = true;
  if (role === "seller" && inv.status === "bozza") {
    const { data: s } = await supabase.from("network_billing_settings").select("bollo_charge").eq("user_id", user.id).maybeSingle();
    bolloCharge = (s as { bollo_charge?: boolean } | null)?.bollo_charge ?? true;
  }
  const overdue = !credit && inv.status === "emessa" && !!inv.due_date && inv.due_date < todayRome();
  const kindLabel = credit ? "nota di credito" : "fattura";
  return (
    <div>
      <Link href={backHref} className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> {backLabel}
      </Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{role === "seller" ? `${credit ? "Nota di credito" : "Fattura"} a ${inv.doc.buyer?.name ?? "cliente"}` : `${credit ? "Nota di credito" : "Fattura"} da ${inv.doc.seller?.name ?? "fornitore"}`}</p>
          <h1 className="mt-1 text-3xl text-[#233c5e]">{inv.status === "bozza" ? `Bozza di ${kindLabel}` : `${credit ? "Nota di credito" : "Fattura"} ${inv.number}`}</h1>
          {credit && linked && (
            <p className="mt-1 text-sm text-slate-600">
              {inv.credit_full ? "Storno totale" : "Rettifica parziale"} della fattura{" "}
              <Link href={`${base}/${linked.id}`} className="font-medium text-[#233c5e] underline">n. {linked.number}</Link> del {fmtDate(linked.issue_date)}
            </p>
          )}
        </div>
        <div className="text-right">
          {credit ? (
            <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-800">{inv.status === "bozza" ? "Bozza" : "Nota di credito emessa"}</span>
          ) : (
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${overdue ? "bg-red-100 text-red-800" : st.tone}`}>{overdue ? "Scaduta" : st.label}</span>
          )}
          <p className="mt-1 text-sm text-slate-600">
            {credit ? "A credito" : "Da pagare"} <strong>{fmtMoney(credit ? t.netto : residuo, inv.currency)}</strong>
            {!credit && partialCredits > 0 ? <span className="text-slate-400"> (fattura {fmtMoney(t.netto, inv.currency)} − note di credito {fmtMoney(partialCredits, inv.currency)})</span> : null}
            {!credit && inv.status === "pagata" && inv.paid_at ? ` · pagata il ${fmtDate(inv.paid_at)}` : !credit && inv.due_date ? ` · entro il ${fmtDate(inv.due_date)}` : ""}
          </p>
        </div>
      </div>
      {inv.status === "stornata" && inv.void_note && <p className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">Stornata: {inv.void_note}</p>}
      {credits.length > 0 && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <p className="flex items-center gap-2 font-semibold"><FileMinus size={15} /> Note di credito collegate</p>
          <ul className="mt-1 space-y-0.5">
            {credits.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/${c.id}`} className="underline">n. {c.number}</Link> del {fmtDate(c.issue_date)} · {fmtMoney(Number(c.netto), inv.currency)} {c.credit_full ? "(storno totale)" : "(parziale)"}
              </li>
            ))}
          </ul>
        </div>
      )}
      {draftCredits.length > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          C&apos;è una nota di credito in bozza per questa fattura: <Link href={`/rete/fatture/${draftCredits[0].id}`} className="font-semibold underline">aprila</Link>.
        </p>
      )}

      {role === "seller" && inv.status === "bozza" ? (
        <>
          {credit && (
            <p className="mb-4 rounded-xl bg-[#faf3e6] px-4 py-3 text-sm text-slate-700">
              {inv.credit_full
                ? "Nota di credito totale: le righe sono quelle della fattura. Quando la emetti, la fattura risulta stornata e i servizi tornano tra quelli da fatturare."
                : "Nota di credito parziale: scrivi nella riga cosa correggi e la differenza (senza IVA). Esempio: «Rettifica prezzo transfer Moore 10/09», 50 €."}
            </p>
          )}
          <InvoiceEditor
            id={inv.id}
            initialDoc={inv.doc}
            initialNumber={inv.number ?? ""}
            initialIssue={inv.issue_date ?? todayRome()}
            initialDue={credit ? null : inv.due_date}
            currency={inv.currency}
            bolloCharge={bolloCharge}
            credit={credit}
          />
        </>
      ) : (
        <div className="space-y-5">
          <InvoiceActions
            id={inv.id}
            role={role}
            status={inv.status}
            canXml={inv.doc.seller?.country === "IT" && inv.currency === "EUR"}
            docType={inv.doc_type ?? "TD01"}
            overdue={overdue}
            remindersSent={inv.reminders_sent ?? 0}
            hasFullCredit={credits.some((c) => c.credit_full) || draftCredits.length > 0}
          />
          <InvoiceView
            doc={inv.doc}
            number={inv.number}
            issueDate={inv.issue_date}
            dueDate={inv.due_date}
            currency={inv.currency}
            status={inv.status}
            docType={inv.doc_type ?? "TD01"}
            linked={linked ? { number: linked.number, date: linked.issue_date } : null}
          />
        </div>
      )}
    </div>
  );
}
