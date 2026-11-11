"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export default function PhotoGallery({ photos }: { photos: { id: string; url: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  // Miniature tutte della stessa dimensione (quadrate), invece della vecchia
  // combinazione foto grande + striscia di miniature piccole: più semplice e
  // non ha mai bisogno di una colonna stretta che può far uscire i bordi
  // dell'immagine su schermi piccoli.
  const grid = (
    <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => setOpenIndex(index)}
          className="relative aspect-square min-w-0 overflow-hidden rounded-md"
        >
          <Image
            src={photo.url}
            alt=""
            fill
            sizes="(min-width: 640px) 12rem, 30vw"
            className="object-cover transition hover:scale-105 hover:opacity-95"
          />
        </button>
      ))}
    </div>
  );

  // Il lightbox va renderizzato in un portale direttamente nel <body>, fuori
  // dalla card dell'attività: quella card ha un effetto hover che la solleva
  // leggermente (una trasformazione CSS), e una trasformazione su un
  // antenato fa sì che un elemento "fixed" al suo interno non sia più
  // ancorato a tutto lo schermo ma solo a quella card — causando sia
  // immagini che escono dai bordi sia un loop di apertura/chiusura quando
  // l'hover si attiva e disattiva mentre il lightbox si riposiziona.
  const lightbox =
    mounted && openIndex !== null
      ? createPortal(
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

            <div onClick={(e) => e.stopPropagation()} className="relative h-[85vh] w-[90vw] max-w-4xl sm:w-[80vw]">
              <Image src={photos[openIndex].url} alt="" fill sizes="90vw" className="rounded-md object-contain" />
            </div>

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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {grid}
      {lightbox}
    </>
  );
}
