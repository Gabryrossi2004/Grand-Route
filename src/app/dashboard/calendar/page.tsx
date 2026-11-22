import { redirect } from "next/navigation";

// Il calendario ora sta in fondo alla Home: si tiene l'indirizzo per i link salvati e per le notifiche già inviate.
export default function CalendarPage() {
  redirect("/dashboard#calendario");
}
