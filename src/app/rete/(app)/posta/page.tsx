import { query, toAgencyMail } from "@/lib/mail/agencyRedirect";
import MailHome from "@/components/mail/MailHome";

export const metadata = { title: "Posta" };

export default async function Page({ searchParams }: { searchParams: Promise<{ cartella?: string; q?: string; pagina?: string }> }) {
  const { cartella, q, pagina } = await searchParams;
  await toAgencyMail(`/dashboard/posta${query({ cartella, q, pagina })}`);
  return <MailHome base="/rete/posta" cartella={cartella} q={q} pagina={pagina} />;
}
