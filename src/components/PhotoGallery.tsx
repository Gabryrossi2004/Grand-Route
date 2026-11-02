"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function PhotoGallery({ photos }: { photos: { id: string; url: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openIndex, photos.length]);

  if (photos.length === 0) return null;

  const [first, ...rest] = photos;

  return (
    <>
      <div className="mt-3 grid grid-cols-[1fr_5rem] gap-1.5">
        <button
          type="button"
          onClick={() => setOpenIndex(0)}
          className="h-48 overflow-hidden rounded-md"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first.url} alt="" className="h-full w-full object-cover transition hover:opacity-90" />
        </button>
        {rest.length > 0 && (
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {rest.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setOpenIndex(index + 1)}
                className="h-[2.85rem] shrink-0 overflow-hidden rounded-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="h-full w-full object-cover transition hover:opacity-90" />
              </button>
            ))}
          </div>
        )}
      </div>

      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Chiudi"
            className="absolute right-4 top-4 rounded-full p-2 text-white hover:bg-white/10"
          >
            <X size={22} />
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
              }}
              aria-label="Foto precedente"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-white hover:bg-white/10 sm:left-4"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[openIndex].url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
          />

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex((i) => (i === null ? i : (i + 1) % photos.length));
              }}
              aria-label="Foto successiva"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-white hover:bg-white/10 sm:right-4"
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
