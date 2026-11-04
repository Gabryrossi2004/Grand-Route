"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

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

  function applyFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0 || !inputRef.current) return;
    const files = Array.from(fileList);
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
      <ImagePlus size={18} className="text-slate-400" />
      <p className="text-sm font-medium text-slate-700">{fileName ?? label}</p>
      <p className="text-xs text-slate-400">Trascina, clicca per scegliere, o incolla con Ctrl+V</p>
    </div>
  );
}
