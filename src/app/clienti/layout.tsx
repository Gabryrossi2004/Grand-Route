import { I18nProvider } from "@/components/I18nProvider";
import { getLang } from "@/lib/i18n/server";

export const metadata = { title: "Area clienti" };

// L'accesso dei clienti parla la lingua scelta dal visitatore (come il resto dell'area clienti).
export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  return <I18nProvider lang={await getLang()}>{children}</I18nProvider>;
}
