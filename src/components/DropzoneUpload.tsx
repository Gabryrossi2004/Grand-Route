"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { compressImageFile } from "@/lib/compressImage";

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

  async function applyFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0 || !inputRef.current) return;
    let files = Array.from(fileList);
    if (compressImages) {
      setProcessing(true);
      try {
        files = await Promise.all(files.map((file) => compressImageFile(file)));
      } finally {
        setProcessing(false);
      }
    }
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    inputRef.current.files = dataTransfer.files;
    setFileName(files[0].name);
    if (autoSubmit) {
      inputRef.current.form?.requestSubmit();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
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
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-[#e6d7bb] ${
        dragOver ? "border-[#cda876] bg-[#faf3e6]" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
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
      <ImagePlus size={18} className="text-slate-500" />
      <p className="text-sm font-medium text-slate-700">{processing ? "Comprimo l'immagine…" : fileName ?? label}</p>
      <p className="text-xs text-slate-500">Trascina, clicca per scegliere, o incolla con Ctrl+V</p>
    </div>
  );
}
