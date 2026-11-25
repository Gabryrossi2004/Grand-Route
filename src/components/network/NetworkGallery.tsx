"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// Foto della vetrina: griglia di miniature e visione a tutto schermo
export default function NetworkGallery({ photos }: { photos: { thumb: string; full: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);
  if (photos.length === 0) return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <button key={p.thumb} type="button" onClick={() => setOpen(i)} className="relative aspect-[4/3] min-w-0 overflow-hidden rounded-xl bg-[#e9dfc9]" aria-label={`Apri la foto ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open].full} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setOpen(null)} className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white" aria-label="Chiudi"><X size={22} /></button>
          {photos.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + photos.length) % photos.length); }} className="absolute left-3 rounded-full bg-white/15 p-2 text-white" aria-label="Foto precedente"><ChevronLeft size={24} /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % photos.length); }} className="absolute right-3 rounded-full bg-white/15 p-2 text-white" aria-label="Foto successiva"><ChevronRight size={24} /></button>
            </>
          )}
        </div>
      )}
    </>
  );
}
