"use client";

import { useState } from "react";

export default function TitleColorField({
  defaultValue,
  title,
  coverUrl,
}: {
  defaultValue: string | null;
  title?: string;
  coverUrl?: string | null;
}) {
  const [useCustom, setUseCustom] = useState(Boolean(defaultValue));
  const [color, setColor] = useState(defaultValue ?? "#ffffff");

  return (
    <div className="sm:col-span-2">
      <label className="mb-1 block text-sm font-medium text-slate-700">Colore del titolo</label>
      <p className="mb-2 text-xs text-slate-500">
        Il titolo del viaggio appare sopra l&apos;immagine di copertina: scegli un colore leggibile in base
        alla tua foto (default: bianco).
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={useCustom}
            onChange={(e) => setUseCustom(e.target.checked)}
            className="rounded border-slate-300"
          />
          Colore personalizzato
        </label>
        {useCustom && (
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-14 cursor-pointer rounded border border-slate-300"
          />
        )}
      </div>
      <input type="hidden" name="title_color" value={useCustom ? color : ""} />

      <div
        className="mt-3 flex h-20 items-end overflow-hidden rounded-lg border border-slate-200 bg-[#233c5e] bg-cover bg-center p-3"
        style={coverUrl ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,.45), rgba(0,0,0,.1)), url(${coverUrl})` } : undefined}
        aria-label="Anteprima del titolo sulla copertina"
      >
        <p className="truncate text-xl font-semibold" style={{ color: useCustom ? color : "#ffffff" }}>
          {title || "Titolo del viaggio"}
        </p>
      </div>
    </div>
  );
}
