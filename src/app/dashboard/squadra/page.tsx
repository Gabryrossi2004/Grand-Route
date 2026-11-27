import { redirect } from "next/navigation";

// Vecchio indirizzo: la pagina ora si chiama «Team»
export default function OldTeamPage() {
  redirect("/dashboard/team");
}
