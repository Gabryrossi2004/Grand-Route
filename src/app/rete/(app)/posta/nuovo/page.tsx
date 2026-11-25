import { query, toAgencyMail } from "@/lib/mail/agencyRedirect";
import NewMessagePage from "@/components/mail/NewMessagePage";

export const metadata = { title: "Nuovo messaggio" };

export default async function Page({ searchParams }: { searchParams: Promise<{ a?: string; oggetto?: string }> }) {
  const { a, oggetto } = await searchParams;
  await toAgencyMail(`/dashboard/posta/nuovo${query({ a, oggetto })}`);
  return <NewMessagePage base="/rete/posta" a={a} oggetto={oggetto} />;
}
