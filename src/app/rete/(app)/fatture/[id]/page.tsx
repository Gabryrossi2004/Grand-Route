import InvoicePage from "@/components/orders/InvoicePage";

export const metadata = { title: "Fattura" };

export default async function NetworkInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoicePage id={id} backHref="/rete/fatture" backLabel="Fatture" />;
}
