"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import AssistantIcon from "@/components/AssistantIcon";
import { ASSISTANT_NAME } from "@/lib/assistant";
import type { ZefiroState } from "@/components/ZefiroAvatar3D";
import { useZefiroVariant } from "@/components/ZefiroStyle";
import type { ZefiroVariantId } from "@/lib/assistant";

// Caricato solo nel browser e solo quando serve: la parte 3D è la più pesante
// del sito e non deve rallentare le pagine che non la mostrano.
const ZefiroAvatar3D = dynamic(() => import("@/components/ZefiroAvatar3D"), { ssr: false });

// Avatar animato di Zefiro. Se il dispositivo non supporta il 3D (WebGL)
// mostra al suo posto la mini icona ferma.
export default function Zefiro({
  size = 96,
  state = "idle",
  variant,
  className,
}: {
  size?: number;
  state?: ZefiroState;
  // Se non indicato vale il costume scelto dall'agenzia nelle Impostazioni.
  variant?: ZefiroVariantId;
  className?: string;
}) {
  const [unsupported, setUnsupported] = useState(false);
  const chosen = useZefiroVariant();

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${ASSISTANT_NAME}, il tuo assistente di viaggio`}
    >
      {unsupported ? (
        <AssistantIcon size={Math.round(size * 0.7)} className="mx-auto mt-[15%]" />
      ) : (
        <ZefiroAvatar3D size={size} state={state} variant={variant ?? chosen} onUnsupported={() => setUnsupported(true)} />
      )}
    </div>
  );
}

// Zefiro che "sta lavorando", con un messaggio: da mostrare mentre si attende
// una risposta (generazione, suggerimenti, esempi).
export function ZefiroThinking({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#e6d7bb] bg-[#faf3e6]/70 px-4 py-3" role="status">
      <Zefiro size={84} state="thinking" className="shrink-0" />
      <div>
        <p className="text-sm font-semibold text-[#233c5e]">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-600">{hint}</p>}
      </div>
    </div>
  );
}
