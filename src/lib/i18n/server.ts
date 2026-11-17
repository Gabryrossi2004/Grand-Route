import { cookies, headers } from "next/headers";
import { LANGUAGE_SWITCH_ENABLED, LANG_COOKIE, langFromAcceptLanguage, localeFor, normalizeLang, translate, type Lang, type TKey, type Vars } from "./index";

// Lingua scelta dal visitatore: prima il cookie, poi la lingua del browser.
export async function getLang(): Promise<Lang> {
  if (!LANGUAGE_SWITCH_ENABLED) return "it";
  const saved = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  if (saved) return saved;
  return langFromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getT() {
  const lang = await getLang();
  return { lang, locale: localeFor(lang), t: (key: TKey, vars?: Vars) => translate(lang, key, vars) };
}
