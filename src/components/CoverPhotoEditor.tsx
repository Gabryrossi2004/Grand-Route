"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { compressImageFile } from "@/lib/compressImage";
import { normalizeImageFile } from "@/lib/normalizeImage";
import { uploadCover } from "@/app/dashboard/trips/[id]/actions";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Copertina del viaggio: doppio clic (o doppio tocco) sulla foto per cambiarla.
// Il titolo, i badge e i pulsanti dentro la copertina non fanno scattare il cambio foto.
export default function CoverPhotoEditor({
  tripId,
  coverUrl,
  className,
  children,
}: {
  tripId: string;
  coverUrl: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Anteprima immediata della foto appena scelta, finché la pagina non porta quella salvata
  const [local, setLocal] = useState<{
    url: string;
    base: string | null;
  } | null>(null);
  // L'anteprima vale finché il server non porta una copertina diversa da quella di partenza
  const localUrl = local && local.base === coverUrl ? local.url : null;

  const [error, setError] = useState<string | null>(null);

  function onDoubleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (
      busy ||
      target.closest("button, a, input, textarea, [data-no-cover-edit]")
    )
      return;
    inputRef.current?.click();
  }

  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  function onDragEnter(e: React.DragEvent) {
    if (busy || !hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }
  function onDragOver(e: React.DragEvent) {
    if (busy || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave(e: React.DragEvent) {
    if (!hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;
    const file = Array.from(e.dataTransfer.files).find(
      (f) =>
        f.type.startsWith("image/") ||
        /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name),
    );
    if (!file) {
      setError("Trascina un'immagine (JPG, PNG o WebP).");
      return;
    }
    void upload(file);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (picked) await upload(picked);
  }

  async function upload(picked: File) {
    setError(null);
    setBusy(true);
    // La nuova foto si vede subito; il salvataggio avviene in background
    const preview = URL.createObjectURL(picked);
    setLocal((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { url: preview, base: coverUrl };
    });
    const undo = () =>
      setLocal((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return null;
      });
    try {
      let file = await normalizeImageFile(picked);
      file = await compressImageFile(file);
      if (file.size > MAX_UPLOAD_BYTES) {
        undo();
        setError("La foto è troppo grande (massimo 10 MB).");
        return;
      }
      const formData = new FormData();
      formData.set("cover", file);
      const result = await uploadCover(tripId, formData);
      if (result && "error" in result) {
        undo();
        setError(result.error);
      } else {
        router.refresh();
      }
    } catch {
      undo();
      setError("Caricamento non riuscito. Controlla la connessione e riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`group/cover ${className ?? ""}`}
      onDoubleClick={onDoubleClick}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {localUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={localUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        coverUrl && (
          <Image
            src={coverUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )
      )}
      {(localUrl || coverUrl) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      )}

      {children}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
        aria-label="Scegli la foto di copertina"
      />

      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        title="Cambia la foto di copertina (doppio clic o trascina una foto qui)"
        aria-label="Cambia la foto di copertina"
        className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 focus-visible:opacity-100 md:opacity-0 md:group-hover/cover:opacity-100"
      >
        <Camera size={16} />
      </button>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white bg-[#17283f]/70 text-white backdrop-blur-sm">
          <ImagePlus size={26} />
          <p className="text-sm font-semibold">
            Rilascia per usare questa foto come copertina
          </p>
        </div>
      )}

      {busy && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
          <Loader2 size={14} className="animate-spin" /> Salvo la foto…
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="absolute inset-x-3 bottom-3 z-20 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
        >
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setError(null)}
          >
            Chiudi
          </button>
        </p>
      )}
    </div>
  );
}
