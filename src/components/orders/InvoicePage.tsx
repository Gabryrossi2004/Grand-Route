import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import InvoiceEditor from "@/components/orders/InvoiceEditor";
import InvoiceView from "@/components/orders/InvoiceView";
import InvoiceActions from "@/components/orders/InvoiceActions";
import { computeTotals, type InvoiceDoc } from "@/lib/invoicing/engine";
import { INVOICE_STATUS, fmtDate, fmtMoney, todayRome } from "@/lib/orders/shared";

type Row = {
  id: string; seller_id: string; buyer_id: string; status: "bozza" | "emessa" | "pagata" | "stornata"; number: string | null;
  issue_date: string | null; due_date: string | null; currency: string; doc: InvoiceDoc; paid_at: string | null; void_note: string | null;
};

// Una fattura: il fornitore la prepara (bozza) e la emette; il cliente la vede da emessa in poi.
export default async function InvoicePage({ id, backHref, backLabel }: { id: string; backHref: string; backLabel: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase.from("network_invoices").select("id, seller_id, buyer_id, status, number, issue_date, due_date, currency, doc, paid_at, void_note").eq("id", id).maybeSingle();
  const inv = data as Row | null;
  if (!inv) notFound();
  const role = inv.seller_id === user.id ? "seller" : "buyer";
  const st = INVOICE_STATUS[inv.status];
  const t = computeTotals(inv.doc);
  let bolloCharge = true;
  if (role === "seller" && inv.status === "bozza") {
    const { data: s } = await supabase.from("network_billing_settings").select("bollo_charge").eq("user_id", user.id).maybeSingle();
    bolloCharge = (s as { bollo_charge?: boolean } | null)?.bollo_charge ?? true;
  }
  const overdue = inv.status === "emessa" && inv.due_date && inv.due_date < todayRome();
  return (
    <div>
      <Link href={backHref} className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> {backLabel}
      </Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{role === "seller" ? `Fattura a ${inv.doc.buyer?.name ?? "cliente"}` : `Fattura da ${inv.doc.seller?.name ?? "fornitore"}`}</p>
          <h1 className="mt-1 text-3xl text-[#233c5e]">{inv.status === "bozza" ? "Bozza di fattura" : `Fattura ${inv.number}`}</h1>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${overdue ? "bg-red-100 text-red-800" : st.tone}`}>{overdue ? "Scaduta" : st.label}</span>
          <p className="mt-1 text-sm text-slate-600">
            Da pagare <strong>{fmtMoney(t.netto, inv.currency)}</strong>
            {inv.status === "pagata" && inv.paid_at ? ` · pagata il ${fmtDate(inv.paid_at)}` : inv.due_date ? ` · entro il ${fmtDate(inv.due_date)}` : ""}
          </p>
        </div>
      </div>
      {inv.status === "stornata" && inv.void_note && <p className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">Stornata: {inv.void_note}</p>}

      {role === "seller" && inv.status === "bozza" ? (
        <InvoiceEditor
          id={inv.id}
          initialDoc={inv.doc}
          initialNumber={inv.number ?? ""}
          initialIssue={inv.issue_date ?? todayRome()}
          initialDue={inv.due_date}
          currency={inv.currency}
          bolloCharge={bolloCharge}
        />
      ) : (
        <div className="space-y-5">
          <InvoiceActions id={inv.id} role={role} status={inv.status} canXml={inv.doc.seller?.country === "IT" && inv.currency === "EUR"} />
          <InvoiceView doc={inv.doc} number={inv.number} issueDate={inv.issue_date} dueDate={inv.due_date} currency={inv.currency} status={inv.status} />
        </div>
      )}
    </div>
  );
}
