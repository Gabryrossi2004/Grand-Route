"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateTripTitle } from "@/app/dashboard/trips/[id]/actions";

export default function TripTitleEditor({ tripId, title }: { tripId: string; title: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  async function save() {
    setIsEditing(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      setValue(title);
      return;
    }
    const formData = new FormData();
    formData.set("title", trimmed);
    await updateTripTitle(tripId, formData);
    router.refresh();
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setValue(title);
            setIsEditing(false);
          }
        }}
        className="w-full rounded-lg border border-white/40 bg-white/10 px-2 py-1 text-3xl font-bold leading-tight text-white outline-none backdrop-blur placeholder:text-white/50"
      />
    );
  }

  return (
    <h1
      onDoubleClick={() => setIsEditing(true)}
      title="Doppio click per modificare il titolo"
      className="cursor-pointer rounded text-3xl font-bold leading-tight drop-shadow-sm hover:bg-white/10"
    >
      {title}
    </h1>
  );
}
