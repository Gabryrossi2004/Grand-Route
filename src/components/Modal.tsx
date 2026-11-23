"use client";

import { X } from "lucide-react";

export default function Modal({
  title,
  onClose,
  children,
  wide,
  icon,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#17283f]/45 p-2 pt-6 backdrop-blur-sm sm:p-4 sm:pt-12">
      <div className={`modal-card w-full ${wide ? "max-w-4xl" : "max-w-lg"} rounded-xl border border-[#e6d7bb] bg-white shadow-2xl`}>
        <div className="flex items-center justify-between gap-2 border-b border-[#f2e2c4] px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="flex min-w-0 items-center gap-2.5 text-lg font-medium text-[#233c5e] sm:text-xl">
            {icon}
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-7">{children}</div>
      </div>
    </div>
  );
}
