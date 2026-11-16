"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/trips", label: "Viaggi" },
  { href: "/dashboard/clients", label: "Clienti" },
  { href: "/dashboard/suppliers", label: "Fornitori" },
  { href: "/dashboard/community", label: "Community" },
  { href: "/dashboard/calendar", label: "Calendario" },
  { href: "/dashboard/settings", label: "Impostazioni" },
];

// Voce attiva sottolineata in oro. "Home" è attiva solo sulla pagina
// esatta (tutte le altre voci iniziano con /dashboard).
export default function DashboardNav({ signOut }: { signOut: () => Promise<void> | void }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-sm">
      {navItems.map((item) => {
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-1.5 font-medium transition ${
              active
                ? "border-[#cda876] text-[#233c5e]"
                : "border-transparent text-[#6b5f4a] hover:text-[#233c5e]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <form action={signOut} className="ml-1 shrink-0">
        <button
          type="submit"
          className="whitespace-nowrap px-3 py-1.5 font-medium text-[#756548] transition hover:text-[#233c5e]"
        >
          Esci
        </button>
      </form>
    </nav>
  );
}
