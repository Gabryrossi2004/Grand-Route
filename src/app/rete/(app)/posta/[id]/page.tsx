import { toAgencyMail } from "@/lib/mail/agencyRedirect";
import ThreadPage from "@/components/mail/ThreadPage";

export const metadata = { title: "Conversazione" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await toAgencyMail(`/dashboard/posta/${encodeURIComponent(id)}`);
  return <ThreadPage id={id} base="/rete/posta" invoiceBase="/rete/fatture" />;
}
