"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import type { TripDocument } from "@/lib/types";
import DropzoneUpload from "@/components/DropzoneUpload";
import SubmitButton from "@/components/SubmitButton";
import {
  deleteDocument,
  deleteDocumentCover,
  renameDocument,
  uploadDocumentCover,
} from "@/app/dashboard/trips/[id]/actions";

type DocumentWithUrls = TripDocument & { signedUrl: string | null; coverUrl: string | null };

export default function DocumentRow({ tripId, document }: { tripId: string; document: DocumentWithUrls }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isAddingCover, setIsAddingCover] = useState(false);
  const [name, setName] = useState(document.file_name);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function saveName() {
    setIsRenaming(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === document.file_name) {
      setName(document.file_name);
      return;
    }
    const formData = new FormData();
    formData.set("file_name", trimmed);
    await renameDocument(tripId, document.id, formData);
    router.refresh();
  }

  return (
    <li className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
      {document.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={document.coverUrl} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-200 text-slate-500">
          <FileText size={18} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {isRenaming ? (
          <input
            ref={inputRef}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveName();
              }
              if (e.key === "Escape") {
                setName(document.file_name);
                setIsRenaming(false);
              }
            }}
            className="w-full rounded border border-[#ddc8a0] px-1.5 py-0.5 text-sm outline-none"
          />
        ) : document.signedUrl ? (
          <a
            href={document.signedUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium text-[#233c5e] hover:underline"
          >
            {document.file_name}
          </a>
        ) : (
          <span className="block truncate text-sm text-slate-700">{document.file_name}</span>
        )}

        {isAddingCover && (
          <div className="mt-2 flex items-start gap-2">
            <form action={uploadDocumentCover.bind(null, tripId, document.id)} encType="multipart/form-data">
              <DropzoneUpload name="file" accept="image/*" label="Foto di copertina" compressImages />
            </form>
            {document.cover_image_path && (
              <form action={deleteDocumentCover.bind(null, tripId, document.id, document.cover_image_path)}>
                <SubmitButton
                  pendingLabel="…"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  Rimuovi copertina
                </SubmitButton>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setIsAddingCover((v) => !v)}
          title="Copertina"
          className={`rounded-md p-1.5 transition hover:bg-slate-100 ${
            isAddingCover ? "text-[#233c5e]" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {isAddingCover ? <X size={15} /> : <ImagePlus size={15} />}
        </button>
        <button
          type="button"
          onClick={() => setIsRenaming(true)}
          title="Rinomina"
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <Pencil size={15} />
        </button>
        <form action={deleteDocument.bind(null, tripId, document.id, document.file_path)}>
          <SubmitButton
            pendingLabel="…"
            className="rounded-md p-1.5 text-red-500 transition hover:bg-red-50"
          >
            <Trash2 size={15} />
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
