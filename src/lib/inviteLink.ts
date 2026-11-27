import { headers } from "next/headers";
import { areaHosts, areaHref } from "@/lib/areas";

// Indirizzo d'invito da mandare ai colleghi: la registrazione dei professionisti con il tuo codice
export async function buildInviteLink(code: string | null | undefined): Promise<string> {
  const path = `/signup${code ? `?invito=${encodeURIComponent(code)}` : ""}`;
  if (areaHosts()) return areaHref("pro", path);
  const host = (await headers()).get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}${path}`;
}
