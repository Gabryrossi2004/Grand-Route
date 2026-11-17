import type { ReactNode } from "react";
import { I18nProvider } from "@/components/I18nProvider";
import { getLang } from "@/lib/i18n/server";

// Pagina pubblica del viaggio: segue la lingua scelta dal visitatore.
export default async function PublicTripLayout({ children }: { children: ReactNode }) {
  return <I18nProvider lang={await getLang()}>{children}</I18nProvider>;
}
