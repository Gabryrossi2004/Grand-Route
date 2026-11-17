"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE, normalizeLang } from "@/lib/i18n";

// Salva la lingua scelta (un anno) e aggiorna le pagine.
export async function setLanguage(lang: string) {
  const valid = normalizeLang(lang);
  if (!valid) return;
  (await cookies()).set(LANG_COOKIE, valid, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}
