"use client";

import { createContext, useContext, useMemo } from "react";
import { localeFor, translate, type Lang, type TKey, type Vars } from "@/lib/i18n";

type I18n = { lang: Lang; locale: string; t: (key: TKey, vars?: Vars) => string };

// Fuori da un provider (per esempio nel gestionale dell'agenzia, che per ora è
// solo in italiano) vale l'italiano.
const I18nContext = createContext<I18n>({
  lang: "it",
  locale: "it-IT",
  t: (key, vars) => translate("it", key, vars),
});

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo<I18n>(() => ({ lang, locale: localeFor(lang), t: (key, vars) => translate(lang, key, vars) }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
