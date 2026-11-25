import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import InvoiceTable from "@/components/orders/InvoiceTable";
import type { InvoiceListRow } from "@/lib/orders/shared";

export const metadata = { title: "Fatture" };

export default async function NetworkInvoices({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const role = vista === "ricevute" ? "buyer" : "seller";
  const user = await getCachedUser();
  if (!user) redirect("/login?next=/rete/fatture");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_invoices_list", { p_role: role });
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${on ? "bg-[#233c5e] text-white" : "border border-[#e6d7bb] bg-white text-[#233c5e]"}`}>{label}</Link>
  );
  return (
    <div>
      <p className="eyebrow">Partner</p>
      <h1 className="mt-1 text-3xl text-[#233c5e]">Fatture</h1>
      <p className="mt-2 max-w-2xl text-base text-slate-600">Le fatture dei servizi svolti tra partner, collegate agli ordini. Le prepari qui, le emetti caricando l&apos;XML sul portale dell&apos;Agenzia delle Entrate o nel tuo programma.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {tab("/rete/fatture", "Emesse da me", role === "seller")}
        {tab("/rete/fatture?vista=ricevute", "Ricevute", role === "buyer")}
        {tab("/rete/lavori", "Servizi", false)}
        <Link href="/rete/fatture/impostazioni" className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-[#233c5e] underline"><Settings size={15} /> Impostazioni di fatturazione</Link>
      </div>
      <div className="mt-6">
        {error ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Serve l&apos;aggiornamento del database (migrazione 0065).</p>
        ) : (
          <InvoiceTable rows={(data ?? []) as InvoiceListRow[]} role={role} base="/rete/fatture" />
        )}
      </div>
    </div>
  );
}
