import { redirect } from "next/navigation";
import { CLIENT_LOGIN } from "@/lib/areas";

// Indirizzo di una volta (/client/login): l'accesso dei clienti è ora in /clienti (uguale per i clienti delle agenzie e per i viaggiatori).
export default function LegacyClientLogin() {
  redirect(CLIENT_LOGIN);
}
