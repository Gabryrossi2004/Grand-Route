import MailHome from "@/components/mail/MailHome";

export const metadata = { title: "Posta" };

export default async function Page({ searchParams }: { searchParams: Promise<{ cartella?: string; q?: string; pagina?: string }> }) {
  const { cartella, q, pagina } = await searchParams;
  return <MailHome base="/dashboard/posta" cartella={cartella} q={q} pagina={pagina} />;
}
