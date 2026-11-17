import { I18nProvider } from "@/components/I18nProvider";
import { getLang } from "@/lib/i18n/server";

// Tutte le pagine dell'area clienti (accesso, registrazione, viaggi) parlano
// la lingua scelta dal visitatore.
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  return <I18nProvider lang={await getLang()}>{children}</I18nProvider>;
}
