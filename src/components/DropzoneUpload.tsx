"use client";

import { useRef, useState } from "react";

export default function DropzoneUpload({
  name,
  accept,
  label,
  autoSubmit = true,
}: {
  name: string;
  accept?: string;
  label: string;
  autoSubmit?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  function applyFiles(files: FileList | null) {
    if (!files || files.length === 0 || !inputRef.current) return;
    inputRef.current.files = files;
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
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
        dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
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
      <p className="text-sm font-medium text-slate-700">{fileName ?? label}</p>
      <p className="mt-1 text-xs text-slate-400">Trascina un file qui oppure clicca per scegliere</p>
    </div>
  );
}
