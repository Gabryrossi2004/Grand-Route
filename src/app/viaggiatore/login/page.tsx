import { redirect } from "next/navigation";
import { CLIENT_LOGIN } from "@/lib/areas";

// Indirizzo di una volta (/viaggiatore/login): l'accesso è ora in /clienti, uguale per tutti i clienti.
export default function LegacyTravelerLogin() {
  redirect(CLIENT_LOGIN);
}
