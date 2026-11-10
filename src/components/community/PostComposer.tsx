"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";

export default function PostComposer({
  action,
  placeholder,
}: {
  action: (prevState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string }>;
  placeholder?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [body, setBody] = useState("");
  const [photoCount, setPhotoCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (state !== prevStateRef.current && !state?.error) {
      setBody("");
      setPhotoCount(0);
      formRef.current?.reset();
    }
    prevStateRef.current = state;
  }, [state]);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formData.set("body", body);
        formAction(formData);
      }}
      className="flex flex-col gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30"
    >
      <input
        type="text"
        name="title"
        placeholder="Titolo (opzionale)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]"
      />
      <RichTextEditor value={body} onChange={setBody} placeholder={placeholder ?? "Scrivi qualcosa…"} />

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#6b5f4a] hover:text-[#2b333e]">
          <ImagePlus size={16} />
          {photoCount > 0 ? `${photoCount} foto selezionate` : "Allega foto"}
          <input
            type="file"
            name="photos"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => setPhotoCount(e.target.files?.length ?? 0)}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#2b333e] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#1e242d] disabled:opacity-60"
        >
          {pending ? "Pubblicazione…" : "Pubblica"}
        </button>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
