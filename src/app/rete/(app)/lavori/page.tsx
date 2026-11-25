import Link from "next/link";
import OrdersHome from "@/components/orders/OrdersHome";

export const metadata = { title: "Lavori e ordini" };

// Lavori che svolgo (sono il fornitore) e ordini che faccio (compro da un fornitore)
export default async function NetworkJobs({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const role = vista === "ordini" ? "buyer" : "seller";
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${on ? "bg-[#233c5e] text-white" : "border border-[#e6d7bb] bg-white text-[#233c5e]"}`}>{label}</Link>
  );
  return (
    <div>
      <p className="eyebrow">Rete professionale</p>
      <h1 className="mt-1 text-3xl text-[#233c5e]">{role === "seller" ? "I miei lavori" : "I miei ordini ai fornitori"}</h1>
      <p className="mt-2 max-w-2xl text-base text-slate-600">
        {role === "seller"
          ? "Gli ordini dei tuoi clienti in un posto solo: confermi, il giorno dopo il servizio risulta svolto e prepari la fattura già compilata."
          : "Ordini ai tuoi fornitori partner: confermati, svolti e fatturati, con le variazioni di prezzo sotto controllo."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tab("/rete/lavori", "Lavori che svolgo", role === "seller")}
        {tab("/rete/lavori?vista=ordini", "Ordini che faccio", role === "buyer")}
        {tab("/rete/fatture", "Fatture", false)}
      </div>
      <div className="mt-6">
        <OrdersHome role={role} base="/rete/lavori" invoiceBase="/rete/fatture" />
      </div>
    </div>
  );
}
