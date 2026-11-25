"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// exact: attiva solo sulla pagina indicata; also: altre sezioni che la rendono attiva (es. le pagine dei viaggi)
export type TabItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean; also?: string[]; badge?: number };

// Menu dei telefoni: barra fissa in basso con icone e nomi, come nelle app (su schermi grandi resta il menu in alto)
export default function MobileTabBar({ items, hideFrom = "sm" }: { items: TabItem[]; hideFrom?: "sm" | "lg" }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Menu"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#e6d7bb] bg-[#faf3e6]/95 backdrop-blur print:hidden ${hideFrom === "lg" ? "lg:hidden" : "sm:hidden"}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((it) => {
          const active =
            (it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`)) ||
            (it.also ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
          return (
            <li key={it.href} className="min-w-0 flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[11px] font-medium leading-tight transition ${active ? "text-[#233c5e]" : "text-[#8a7a5e]"}`}
              >
                <span className={`relative flex h-7 w-12 items-center justify-center rounded-full ${active ? "bg-[#233c5e]/10" : ""}`}>
                  {it.icon}
                  {!!it.badge && (
                    <span className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-[#c0392b] px-1 text-center text-[10px] font-semibold leading-4 text-white">{it.badge > 9 ? "9+" : it.badge}</span>
                  )}
                </span>
                <span className="max-w-full truncate">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
