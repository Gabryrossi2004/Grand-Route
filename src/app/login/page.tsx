import { redirect } from "next/navigation";
import { PRO_LOGIN, safeNext } from "@/lib/areas";

// Indirizzo di una volta (/login): l'accesso dei professionisti è ora in /professionisti.
// Si mantiene per i link già in giro (segnalibri, email) e porta lì, conservando la pagina di destinazione.
export default async function LegacyLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const ok = safeNext("pro", next);
  redirect(ok ? `${PRO_LOGIN}?next=${encodeURIComponent(ok)}` : PRO_LOGIN);
}
