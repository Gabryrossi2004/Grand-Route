import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import OrdersHome from "@/components/orders/OrdersHome";
import InvoiceTable from "@/components/orders/InvoiceTable";
import type { InvoiceListRow } from "@/lib/orders/shared";

export const metadata = { title: "Ordini e fatture dei fornitori" };

// Per l'agenzia: ordini ai fornitori della Rete e fatture ricevute, collegati ai viaggi
export default async function DashboardOrders({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const invoices = vista === "fatture";
  let rows: InvoiceListRow[] = [];
  let failed = false;
  if (invoices) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("network_invoices_list", { p_role: "buyer" });
    rows = (data ?? []) as InvoiceListRow[];
    failed = !!error;
  }
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${on ? "bg-[#233c5e] text-white" : "border border-[#e6d7bb] bg-white text-[#233c5e]"}`}>{label}</Link>
  );
  return (
    <div>
      <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Ordini e fatture dei fornitori</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        Ordini ai fornitori partner della Rete: il fornitore conferma, il giorno dopo il servizio risulta svolto e la fattura arriva qui già collegata al viaggio.
        Puoi ordinare anche da un viaggio, in «Servizi e fornitori».
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tab("/dashboard/ordini", "Ordini", !invoices)}
        {tab("/dashboard/ordini?vista=fatture", "Fatture ricevute", invoices)}
        {tab("/rete/riconferme", "Riconferme", false)}
        <Link href="/rete/lavori" className="ml-auto self-center text-sm font-medium text-[#233c5e] underline">Svolgi anche tu servizi per altri? Vai ai tuoi lavori</Link>
      </div>
      <div className="mt-6">
        {invoices ? (
          failed ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Serve l&apos;aggiornamento del database (migrazione 0065).</p>
          ) : (
            <InvoiceTable rows={rows} role="buyer" base="/dashboard/ordini/fatture" />
          )
        ) : (
          <OrdersHome role="buyer" base="/dashboard/ordini" invoiceBase="/dashboard/ordini/fatture" />
        )}
      </div>
    </div>
  );
}
