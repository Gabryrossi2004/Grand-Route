import Link from "next/link";
import { Gift } from "lucide-react";
import type { WelcomeBonus } from "@/lib/welcomeBonus";

// Fascia sottile in Home durante i 30 giorni di Zefiro Plus in regalo
export default function WelcomeBonusBanner({ bonus }: { bonus: WelcomeBonus }) {
  return (
    <Link
      href="/dashboard/settings"
      className="flex items-center gap-3 rounded-2xl border border-[#cda876] bg-gradient-to-r from-[#fdf6e6] to-[#faf3e6] px-4 py-3 text-sm text-[#233c5e] shadow-sm transition hover:shadow-md"
    >
      <Gift size={20} className="shrink-0 text-[#c58f2d]" aria-hidden />
      <span className="min-w-0">
        <strong>Zefiro Plus in regalo per i tuoi primi 30 giorni:</strong> ancora {bonus.daysLeft} {bonus.daysLeft === 1 ? "giorno" : "giorni"}. Usalo quanto vuoi: itinerari, bozze di messaggi, traduzioni.
      </span>
    </Link>
  );
}
