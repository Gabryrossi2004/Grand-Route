"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; children: NavLink[] };
type NavItem = NavLink | NavGroup;

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/trips", label: "Viaggi" },
  {
    label: "Anagrafiche",
    children: [
      { href: "/dashboard/clients", label: "Clienti" },
      { href: "/dashboard/suppliers", label: "Fornitori" },
    ],
  },
  { href: "/dashboard/community", label: "Community" },
  { href: "/dashboard/calendar", label: "Calendario" },
  { href: "/dashboard/settings", label: "Impostazioni" },
];

const isGroup = (item: NavItem): item is NavGroup => "children" in item;

// "Home" è attiva solo sulla pagina esatta (le altre voci iniziano con /dashboard).
function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

const linkBase = "whitespace-nowrap border-b-2 px-3 py-1.5 font-medium transition";
const linkOn = "border-[#cda876] text-[#233c5e]";
const linkOff = "border-transparent text-[#6b5f4a] hover:text-[#233c5e]";

// Su computer: voci in linea, con "Anagrafiche" che apre un sottomenù.
// Su telefono: un solo pulsante menù che apre un elenco a tutta larghezza,
// con voci grandi e facili da toccare (niente più scorrimento orizzontale).
export default function DashboardNav({ signOut }: { signOut: () => Promise<void> | void }) {
  const pathname = usePathname();
  const [groupOpen, setGroupOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Chiude i menù quando si cambia pagina
  useEffect(() => {
    setGroupOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  // Chiude con Esc o toccando fuori
  useEffect(() => {
    if (!groupOpen && !mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGroupOpen(false);
        setMobileOpen(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setGroupOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [groupOpen, mobileOpen]);

  return (
    <div ref={wrapRef} className="relative text-sm">
      {/* Computer */}
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Menù principale">
        {navItems.map((item) => {
          if (isGroup(item)) {
            const active = item.children.some((c) => isActive(pathname, c.href));
            return (
              <div key={item.label} className="relative">
                <button
                  type="button"
                  aria-expanded={groupOpen}
                  aria-haspopup="menu"
                  onClick={() => setGroupOpen((v) => !v)}
                  className={`${linkBase} inline-flex items-center gap-1 ${active ? linkOn : linkOff}`}
                >
                  {item.label}
                  <ChevronDown size={14} className={`transition ${groupOpen ? "rotate-180" : ""}`} />
                </button>
                {groupOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-30 mt-2 min-w-40 overflow-hidden rounded-2xl border border-[#e6d7bb] bg-[#faf3e6] p-1.5 shadow-lg"
                  >
                    {item.children.map((child) => {
                      const childActive = isActive(pathname, child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          role="menuitem"
                          aria-current={childActive ? "page" : undefined}
                          className={`block rounded-xl px-3 py-2 font-medium transition hover:bg-[#f1e6cf] ${
                            childActive ? "bg-[#f1e6cf] text-[#233c5e]" : "text-[#6b5f4a]"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`${linkBase} ${active ? linkOn : linkOff}`}
            >
              {item.label}
            </Link>
          );
        })}
        <form action={signOut} className="ml-1">
          <button type="submit" className="whitespace-nowrap px-3 py-1.5 font-medium text-[#756548] transition hover:text-[#233c5e]">
            Esci
          </button>
        </form>
      </nav>

      {/* Telefono */}
      <button
        type="button"
        aria-label={mobileOpen ? "Chiudi il menù" : "Apri il menù"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e6d7bb] bg-white/70 text-[#233c5e] transition hover:bg-white lg:hidden"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {mobileOpen && (
        <nav
          aria-label="Menù principale"
          className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#e6d7bb] bg-[#faf3e6] p-2 shadow-xl lg:hidden"
        >
          {navItems.map((item) => {
            if (isGroup(item)) {
              return (
                <div key={item.label} className="mt-1">
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[#a08a5e]">{item.label}</p>
                  {item.children.map((child) => {
                    const active = isActive(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-xl py-3 pl-6 pr-3 text-base font-medium ${
                          active ? "bg-[#f1e6cf] text-[#233c5e]" : "text-[#6b5f4a]"
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              );
            }
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-xl px-3 py-3 text-base font-medium ${
                  active ? "bg-[#f1e6cf] text-[#233c5e]" : "text-[#6b5f4a]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <form action={signOut} className="mt-1 border-t border-[#e6d7bb] pt-1">
            <button type="submit" className="block w-full rounded-xl px-3 py-3 text-left text-base font-medium text-[#756548]">
              Esci
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
