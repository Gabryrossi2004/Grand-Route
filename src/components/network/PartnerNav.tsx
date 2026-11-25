"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PartnerNavItem = { href: string; label: string; badge?: number; also?: string[] };

// La scheda di un professionista (/rete/<id>) fa parte di «Trova»
const isProfilePage = (p: string) => /^\/rete\/[0-9a-f-]{36}/.test(p);

export function partnerItemActive(pathname: string, it: PartnerNavItem) {
  if (it.href === "/rete") return pathname === "/rete" || isProfilePage(pathname);
  return [it.href, ...(it.also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

// Menu in alto della sezione Partner (computer): la voce della pagina in cui sei resta evidenziata
export default function PartnerNav({ items, children, showFrom = "sm" }: { items: PartnerNavItem[]; children?: React.ReactNode; showFrom?: "sm" | "lg" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu Partner" className={`hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#e6d7bb] bg-white p-1 text-sm ${showFrom === "lg" ? "lg:flex" : "sm:flex"}`}>
      {items.map((it) => {
        const on = partnerItemActive(pathname, it);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 font-medium transition ${on ? "bg-[#233c5e] text-white" : "text-[#6b5f4a] hover:bg-[#faf3e6] hover:text-[#233c5e]"}`}
          >
            {it.label}
            {!!it.badge && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${on ? "bg-white text-[#233c5e]" : "bg-[#c0392b] text-white"}`}>{it.badge}</span>
            )}
          </Link>
        );
      })}
      {children}
    </nav>
  );
}
