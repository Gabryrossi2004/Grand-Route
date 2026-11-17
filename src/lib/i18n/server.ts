import { cookies, headers } from "next/headers";
import { LANG_COOKIE, langFromAcceptLanguage, localeFor, normalizeLang, translate, type Lang, type TKey, type Vars } from "./index";

// Lingua scelta dal visitatore: prima il cookie, poi la lingua del browser.
export async function getLang(): Promise<Lang> {
  const saved = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  if (saved) return saved;
  return langFromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getT() {
  const lang = await getLang();
  return { lang, locale: localeFor(lang), t: (key: TKey, vars?: Vars) => translate(lang, key, vars) };
}
