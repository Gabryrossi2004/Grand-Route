"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { compressImageFile } from "@/lib/compressImage";
import { normalizeImageFile } from "@/lib/normalizeImage";
import { uploadCover } from "@/app/dashboard/trips/[id]/actions";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Copertina del viaggio: doppio clic (o doppio tocco) sulla foto per cambiarla.
// Il titolo, i badge e i pulsanti dentro la copertina non fanno scattare il cambio foto.
export default function CoverPhotoEditor({
  tripId,
  className,
  children,
}: {
  tripId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onDoubleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (busy || target.closest("button, a, input, textarea, [data-no-cover-edit]")) return;
    inputRef.current?.click();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null);
    setBusy(true);
    try {
      let file = await normalizeImageFile(picked);
      file = await compressImageFile(file);
      if (file.size > MAX_UPLOAD_BYTES) {
        setError("La foto è troppo grande (massimo 10 MB).");
        return;
      }
      const formData = new FormData();
      formData.set("cover", file);
      const result = await uploadCover(tripId, formData);
      if (result && "error" in result) setError(result.error);
      else router.refresh();
    } catch {
      setError("Caricamento non riuscito. Controlla la connessione e riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`group/cover ${className ?? ""}`} onDoubleClick={onDoubleClick}>
      {children}

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} aria-label="Scegli la foto di copertina" />

      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        title="Cambia la foto di copertina (anche con doppio clic sulla foto)"
        aria-label="Cambia la foto di copertina"
        className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65 focus-visible:opacity-100 md:opacity-0 md:group-hover/cover:opacity-100"
      >
        <Camera size={16} />
      </button>

      {busy && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-black/50 text-sm font-medium text-white">
          <Loader2 size={18} className="animate-spin" /> Carico la foto…
        </div>
      )}
      {error && (
        <p role="alert" className="absolute inset-x-3 bottom-3 z-20 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white">
          {error}{" "}
          <button type="button" className="underline" onClick={() => setError(null)}>
            Chiudi
          </button>
        </p>
      )}
    </div>
  );
}
