import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNetworkUser } from "@/lib/team";
import OrdersBoard from "@/components/orders/OrdersBoard";
import type { OrderPartner, OrderRow } from "@/lib/orders/shared";

// Pagina degli ordini, per chi svolge i servizi («lavori») e per chi li compra («ordini»)
export default async function OrdersHome({ role, base, invoiceBase, switchHref }: { role: "seller" | "buyer"; base: string; invoiceBase: string; switchHref?: { href: string; label: string } }) {
  const user = await getNetworkUser();
  if (!user) redirect(`/professionisti?next=${base}`);
  const supabase = await createClient();
  const [{ data, error }, { data: partners }, { data: settings }, { data: profile }] = await Promise.all([
    supabase.rpc("network_orders_list", { p_role: "all" }),
    supabase.rpc("network_order_partners"),
    role === "seller" ? supabase.from("network_billing_settings").select("user_id").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("network_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (error)
    return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per ordini e fatture serve l&apos;aggiornamento del database (migrazione 0065, in Supabase → SQL Editor).</p>;
  const orders = (data ?? []) as OrderRow[];
  return (
    <div>
      {switchHref && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <Link href={switchHref.href} className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 font-medium text-[#233c5e] hover:border-[#c58f2d]">{switchHref.label}</Link>
        </div>
      )}
      {role === "seller" && !profile && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Per ricevere ordini e fare fatture completa <Link href="/rete/profilo" className="font-semibold underline">il tuo profilo</Link>.
        </p>
      )}
      {role === "seller" && profile && !settings && (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-[#faf3e6] px-4 py-3 text-sm text-slate-700">
          <Settings size={16} className="text-[#c58f2d]" /> Imposta una volta regime fiscale, IVA, IBAN e numerazione: poi ogni fattura si compila da sola.
          <Link href="/rete/fatture/impostazioni" className="font-semibold text-[#233c5e] underline">Impostazioni di fatturazione</Link>
        </p>
      )}
      <OrdersBoard role={role} orders={orders} me={user.id} partners={(partners ?? []) as OrderPartner[]} invoiceBase={invoiceBase} />
    </div>
  );
}
