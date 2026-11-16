"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { extractLogoPalette } from "@/lib/logoPalette";

// I colori del sito Grand Route, sempre disponibili come scelta rapida.
const SITE_PALETTE: { name: string; hex: string }[] = [
  { name: "Blu notte", hex: "#233c5e" },
  { name: "Oro", hex: "#cda876" },
  { name: "Verde salvia", hex: "#3f6b52" },
  { name: "Bordeaux", hex: "#7a2e3a" },
  { name: "Petrolio", hex: "#2f5d62" },
  { name: "Terracotta", hex: "#b4573a" },
];

function Swatch({
  hex,
  name,
  selected,
  onPick,
}: {
  hex: string;
  name: string;
  selected: boolean;
  onPick: (hex: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(hex)}
      title={`${name} ${hex}`}
      aria-label={`${name} ${hex}`}
      aria-pressed={selected}
      style={{ backgroundColor: hex }}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition hover:scale-105 ${
        selected ? "border-[#233c5e] ring-2 ring-[#cda876]" : "border-black/10"
      }`}
    >
      {selected && <Check size={15} className="text-white drop-shadow" />}
    </button>
  );
}

// Scelta del colore del brand: selettore libero, colori ricavati dal logo
// dell'agenzia e palette del sito. Il valore scelto viene inviato col form.
export default function BrandColorField({ defaultColor, logoUrl }: { defaultColor: string; logoUrl: string | null }) {
  const [color, setColor] = useState(defaultColor);
  const [fromLogo, setFromLogo] = useState<string[]>([]);

  useEffect(() => {
    if (!logoUrl) {
      setFromLogo([]);
      return;
    }
    let cancelled = false;
    extractLogoPalette(logoUrl).then((palette) => {
      if (!cancelled) setFromLogo(palette);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  return (
    <div>
      <label htmlFor="brand_color" className="mb-1 block text-sm font-medium text-slate-700">
        Colore del brand
      </label>
      <div className="flex items-center gap-3">
        <input
          id="brand_color"
          name="brand_color"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-20 cursor-pointer rounded-md border border-slate-300"
        />
        <span className="font-mono text-sm uppercase text-slate-500">{color}</span>
      </div>

      {fromLogo.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-slate-600">Suggeriti dal tuo logo</p>
          <div className="flex flex-wrap gap-2">
            {fromLogo.map((hex) => (
              <Swatch key={hex} hex={hex} name="Colore del logo" selected={same(hex, color)} onPick={setColor} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-slate-600">Colori Grand Route</p>
        <div className="flex flex-wrap gap-2">
          {SITE_PALETTE.map((item) => (
            <Swatch key={item.hex} hex={item.hex} name={item.name} selected={same(item.hex, color)} onPick={setColor} />
          ))}
        </div>
      </div>
    </div>
  );
}
