"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import Modal from "@/components/Modal";

// Le card "Informazioni viaggio / Tariffa & Termini / Emergenza / Promemoria"
// aprono un modale ampio con sfondo scurito invece di espandersi sul posto:
// da affiancate e strette com'è il loro riquadro chiuso, il contenuto del
// modulo (specie quello di Informazioni viaggio) ci stava stretto.
export default function ExpandableSection({
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-[280px] flex-1 items-center justify-between gap-2 rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ee] px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-slate-500 shadow-sm transition hover:border-[#cda876]"
      >
        <span className="flex items-center gap-2">
          {title}
          {badge}
        </span>
        <ChevronRight size={16} className="shrink-0 text-slate-500" />
      </button>

      {open && (
        <Modal title={title} onClose={() => setOpen(false)} wide>
          {children}
        </Modal>
      )}
    </>
  );
}
