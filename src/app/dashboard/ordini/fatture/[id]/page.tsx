import InvoicePage from "@/components/orders/InvoicePage";

export const metadata = { title: "Fattura del fornitore" };

export default async function DashboardInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoicePage id={id} backHref="/dashboard/ordini?vista=fatture" backLabel="Fatture dei fornitori" />;
}
