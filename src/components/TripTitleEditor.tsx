"use client";

import { useEffect, useRef, useState } from "react";
import { useZefiroStyle } from "@/components/ZefiroStyle";
import { updateTripTitle } from "@/app/dashboard/trips/[id]/actions";

export default function TripTitleEditor({
  tripId,
  title,
  destination = null,
  color,
}: {
  tripId: string;
  title: string;
  destination?: string | null;
  color?: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  // Titolo mostrato: si aggiorna subito, senza aspettare il server
  const [shown, setShown] = useState(title);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setTrip } = useZefiroStyle();

  // Se il titolo cambia dal server (o da un'altra scheda) lo riallineiamo
  useEffect(() => {
    setShown(title);
    setValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  async function save() {
    setIsEditing(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === shown) {
      setValue(shown);
      return;
    }
    // Aggiornamento immediato: il titolo e il costume di Zefiro cambiano
    // subito; il salvataggio prosegue in secondo piano.
    const previous = shown;
    setShown(trimmed);
    setValue(trimmed);
    setTrip({ destination, title: trimmed });
    const formData = new FormData();
    formData.set("title", trimmed);
    try {
      await updateTripTitle(tripId, formData);
    } catch {
      // Salvataggio fallito: torniamo al titolo precedente
      setShown(previous);
      setValue(previous);
      setTrip({ destination, title: previous });
    }
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
            setValue(shown);
            setIsEditing(false);
          }
        }}
        style={{ color: color || "#ffffff" }}
        className="w-full rounded-lg border border-white/40 bg-white/10 px-2 py-1 text-3xl font-bold leading-tight outline-none backdrop-blur placeholder:text-white/50"
      />
    );
  }

  return (
    <h1
      onDoubleClick={() => setIsEditing(true)}
      title="Doppio click per modificare il titolo"
      style={{ color: color || "#ffffff" }}
      className="cursor-pointer rounded text-3xl font-bold leading-tight drop-shadow-sm hover:bg-white/10"
    >
      {shown}
    </h1>
  );
}
