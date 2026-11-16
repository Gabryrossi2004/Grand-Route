"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { compressImageFile } from "@/lib/compressImage";
import { normalizeImageFile } from "@/lib/normalizeImage";
import { useUploadStatus } from "@/components/UploadForm";

// Il limite delle richieste verso il server è di 10 MB: oltre, il caricamento
// fallirebbe comunque, quindi lo diciamo subito, prima di inviare.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export default function DropzoneUpload({
  name,
  accept,
  label,
  autoSubmit = true,
  compressImages = false,
}: {
  name: string;
  accept?: string;
  label: string;
  autoSubmit?: boolean;
  // Vero solo per le foto destinate a essere semplicemente guardate (foto
  // attività, copertine): vengono ridimensionate/ricompresse nel browser
  // prima dell'upload, molto più pesanti altrimenti se scattate da telefono.
  // Mai per documenti scansionati o foto caricate per l'analisi AI, dove
  // la definizione originale conta.
  compressImages?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const upload = useUploadStatus();

  const uploading = upload?.status.state === "uploading";
  const busy = processing || uploading;
  const done = upload?.status.state === "done";
  const errorMessage = localError ?? (upload?.status.state === "error" ? upload.status.message : null);

  async function applyFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0 || !inputRef.current || busy) return;
    setLocalError(null);
    let files = Array.from(fileList);
    setProcessing(true);
    try {
      // Corregge i file con estensione sbagliata (es. WebP chiamato .jpg) o
      // in formati non accettati, poi, se richiesto, riduce le foto.
      files = await Promise.all(files.map((file) => normalizeImageFile(file)));
      if (compressImages) {
        files = await Promise.all(files.map((file) => compressImageFile(file)));
      }
    } finally {
      setProcessing(false);
    }
    const tooBig = files.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      const message = `Il file "${tooBig.name}" è troppo grande (massimo 10 MB).`;
      if (upload) upload.reportError(message);
      else setLocalError(message);
      return;
    }
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    inputRef.current.files = dataTransfer.files;
    if (!upload) setFileName(files[0].name);
    if (autoSubmit) {
      inputRef.current.form?.requestSubmit();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        applyFiles(e.dataTransfer.files);
      }}
      onPaste={(e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const files: File[] = [];
        for (const item of Array.from(items)) {
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
        if (files.length > 0) {
          e.preventDefault();
          applyFiles(files);
        }
      }}
      aria-busy={busy}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#e6d7bb] ${
        busy ? "cursor-wait" : "cursor-pointer"
      } ${
        errorMessage
          ? "border-red-300 bg-red-50"
          : done
            ? "border-green-300 bg-green-50"
            : busy
              ? "border-[#cda876] bg-[#faf3e6]"
              : dragOver
                ? "border-[#cda876] bg-[#faf3e6]"
                : "border-slate-300 bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        className="hidden"
        onChange={(e) => applyFiles(e.target.files)}
      />
      {errorMessage ? (
        <>
          <AlertCircle size={18} className="text-red-600" />
          <p className="text-sm font-medium text-red-700" role="alert">
            {errorMessage}
          </p>
          <p className="text-xs text-red-600/80">Clicca per riprovare</p>
        </>
      ) : done ? (
        <>
          <CheckCircle2 size={18} className="text-green-600" />
          <p className="text-sm font-medium text-green-700">Caricata</p>
        </>
      ) : busy ? (
        <>
          <Loader2 size={18} className="animate-spin text-[#233c5e]" />
          <p className="text-sm font-medium text-slate-700">
            {processing
              ? "Preparo l'immagine…"
              : `Caricamento${upload?.status.state === "uploading" ? ` di ${upload.status.fileName}` : ""}…`}
          </p>
        </>
      ) : (
        <>
          <ImagePlus size={18} className="text-slate-500" />
          <p className="text-sm font-medium text-slate-700">{fileName ?? label}</p>
          <p className="text-xs text-slate-500">Trascina, clicca per scegliere, o incolla con Ctrl+V</p>
        </>
      )}
    </div>
  );
}
