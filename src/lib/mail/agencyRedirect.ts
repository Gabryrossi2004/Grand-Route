import { redirect } from "next/navigation";
import { getBusinessKind } from "@/lib/network/server";
import { isTradeKind } from "@/lib/network/kinds";

// Agenzie e tour operator hanno la Posta solo nel gestionale (Messaggi → Posta con i partner):
// chi arriva su /rete/posta (link, notifiche, email) viene portato lì. I fornitori la usano nella sezione Partner.
export async function toAgencyMail(target: string) {
  if (isTradeKind(await getBusinessKind())) redirect(target);
}

export function query(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  return qs ? `?${qs}` : "";
}
