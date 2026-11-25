import { notFound, redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import InvoiceView from "@/components/orders/InvoiceView";
import PrintButton from "@/components/orders/PrintButton";
import type { InvoiceDoc } from "@/lib/invoicing/engine";

export const metadata = { title: "Fattura" };

// Pagina pulita da stampare o salvare in PDF (dal browser: Stampa → Salva come PDF)
export default async function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase.from("network_invoices").select("number, issue_date, due_date, currency, status, doc").eq("id", id).maybeSingle();
  const inv = data as { number: string | null; issue_date: string | null; due_date: string | null; currency: string; status: string; doc: InvoiceDoc } | null;
  if (!inv) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl bg-white px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <InvoiceView doc={inv.doc} number={inv.number} issueDate={inv.issue_date} dueDate={inv.due_date} currency={inv.currency} status={inv.status} />
    </main>
  );
}
