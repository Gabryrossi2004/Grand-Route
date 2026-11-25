import NewMessagePage from "@/components/mail/NewMessagePage";

export const metadata = { title: "Nuovo messaggio" };

export default async function Page({ searchParams }: { searchParams: Promise<{ a?: string; oggetto?: string }> }) {
  const { a, oggetto } = await searchParams;
  return <NewMessagePage base="/rete/posta" a={a} oggetto={oggetto} />;
}
