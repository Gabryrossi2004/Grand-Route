import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import BillingSettingsForm from "@/components/orders/BillingSettingsForm";
import { DEFAULT_SETTINGS, type BillingSettings } from "@/lib/invoicing/draft";

export const metadata = { title: "Impostazioni di fatturazione" };

export default async function BillingSettingsPage() {
  const user = await getCachedUser();
  if (!user) redirect("/professionisti?next=/rete/fatture/impostazioni");
  const supabase = await createClient();
  const [{ data, error }, { data: profile }] = await Promise.all([
    supabase.from("network_billing_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("network_profiles").select("legal_form, business_name, vat_number, country").eq("user_id", user.id).maybeSingle(),
  ]);
  if (error) return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Serve l&apos;aggiornamento del database (migrazione 0065).</p>;
  const p = profile as { legal_form: string | null; business_name: string; vat_number: string; country: string } | null;
  const initial = { ...DEFAULT_SETTINGS, ...((data as Partial<BillingSettings> | null) ?? {}) } as BillingSettings;
  return (
    <div>
      <Link href="/rete/fatture" className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Fatture</Link>
      <p className="eyebrow">Partner</p>
      <h1 className="mt-1 text-3xl text-[#233c5e]">Impostazioni di fatturazione</h1>
      {p ? (
        <p className="mt-2 text-base text-slate-600">In fattura come <strong>{p.business_name}</strong>, P. IVA {p.vat_number} (dal <Link href="/rete/profilo" className="underline">profilo</Link>).</p>
      ) : (
        <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Prima completa <Link href="/rete/profilo" className="font-semibold underline">il tuo profilo</Link>: servono partita IVA e sede.</p>
      )}
      {p && p.country !== "IT" && (
        <p className="mt-3 rounded-xl bg-[#faf3e6] px-4 py-3 text-sm text-slate-700">La tua sede è fuori dall&apos;Italia: Grand Route ti prepara la fattura in PDF con i dati del cliente, da emettere secondo le regole del tuo paese. Il file XML italiano non serve.</p>
      )}
      <div className="mt-6">
        <BillingSettingsForm initial={initial} legalForm={p?.legal_form ?? null} />
      </div>
    </div>
  );
}
