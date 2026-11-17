"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AgencyLogo from "@/components/AgencyLogo";
import DropzoneUpload from "@/components/DropzoneUpload";
import UploadForm from "@/components/UploadForm";
import { LOGO_SHAPES, type LogoShape } from "@/lib/logoShape";
import { trimLogoFile, trimLogoFromUrl } from "@/lib/trimLogo";
import { setLogoShape, uploadLogo } from "./actions";

// Il logo si carica subito, con l'esito (o l'errore e la sua causa) in vista:
// non dipende dal pulsante "Salva impostazioni" del resto della pagina.
// La forma si sceglie con un tocco e si salva subito.
export default function LogoUploader({ logoUrl, initialShape }: { logoUrl: string | null; initialShape: LogoShape }) {
  const router = useRouter();
  const [shape, setShape] = useState<LogoShape>(initialShape);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Un logo caricato prima del ritaglio automatico può avere ancora bordi
  // vuoti o sfondo bianco: lo sistemiamo una volta sola, in silenzio.
  useEffect(() => {
    if (!logoUrl) return;
    const key = `logo-trimmed:${logoUrl}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* senza sessionStorage si prova comunque, una volta per visita */
    }
    let cancelled = false;
    (async () => {
      const trimmed = await trimLogoFromUrl(logoUrl);
      if (cancelled || !trimmed || !trimmed.changed) return;
      const formData = new FormData();
      formData.set("logo", trimmed.file);
      const uploaded = await uploadLogo(formData);
      if (!(uploaded && "error" in uploaded)) router.refresh();
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [logoUrl, router]);

  async function chooseShape(next: LogoShape) {
    if (next === shape || busy) return;
    const previous = shape;
    setShape(next);
    setMessage(null);
    setBusy(true);
    try {
      const result = await setLogoShape(next);
      if ("error" in result) {
        setShape(previous);
        setMessage(result.error);
      } else {
        router.refresh();
      }
    } catch (error) {
      setShape(previous);
      setMessage(error instanceof Error && error.message ? error.message : "Non è stato possibile salvare. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-[#e6d7bb] bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-[#233c5e]">Logo dell&apos;agenzia</h2>
      <p className="mb-4 text-xs text-slate-500">
        Compare nell&apos;intestazione e nelle pagine dei tuoi viaggi. JPG, PNG, WebP o GIF, fino a 8 MB. Lo sfondo bianco
        e i bordi vuoti vengono tolti da soli.
      </p>
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <div className="flex h-20 min-w-20 max-w-48 shrink-0 items-center justify-center rounded-lg bg-[#faf3e6] px-2">
            <AgencyLogo src={logoUrl} shape={shape} size={64} />
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">
            Nessun logo
          </div>
        )}
        <UploadForm action={uploadLogo} className="min-w-0 flex-1">
          <DropzoneUpload
            name="logo"
            accept="image/*"
            label={logoUrl ? "Cambia logo" : "Carica logo"}
            processFile={trimLogoFile}
          />
        </UploadForm>
      </div>

      {logoUrl && (
        <fieldset className="mt-5" disabled={busy}>
          <legend className="mb-2 text-sm font-medium text-slate-700">Forma del logo</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LOGO_SHAPES.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition ${
                  shape === option.id ? "border-[#cda876] bg-[#faf3e6]" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="logo_shape"
                  value={option.id}
                  checked={shape === option.id}
                  onChange={() => chooseShape(option.id)}
                  className="sr-only"
                />
                <span className="flex h-14 items-center justify-center">
                  <AgencyLogo src={logoUrl} shape={option.id} size={48} />
                </span>
                <span className="text-xs font-medium text-slate-800">{option.label}</span>
              </label>
            ))}
          </div>
          {busy && <p className="mt-2 text-xs text-slate-500">Salvataggio…</p>}
          {message && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {message}
            </p>
          )}
        </fieldset>
      )}
    </section>
  );
}
