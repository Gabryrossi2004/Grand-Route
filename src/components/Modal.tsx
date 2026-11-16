"use client";

import { X } from "lucide-react";

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#17283f]/45 p-4 pt-12 backdrop-blur-sm">
      <div className={`modal-card w-full ${wide ? "max-w-4xl" : "max-w-lg"} rounded-xl border border-[#e6d7bb] bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-[#f2e2c4] px-6 py-4">
          <h3 className="text-xl font-medium text-[#233c5e]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto p-7">{children}</div>
      </div>
    </div>
  );
}
