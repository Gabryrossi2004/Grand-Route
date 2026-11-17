import type { ReactNode } from "react";
import { I18nProvider } from "@/components/I18nProvider";
import { getLang } from "@/lib/i18n/server";

// Queste pagine sono condivise con le agenzie: seguono la lingua scelta
// nel cookie (italiano di default).
export default async function Layout({ children }: { children: ReactNode }) {
  return <I18nProvider lang={await getLang()}>{children}</I18nProvider>;
}
