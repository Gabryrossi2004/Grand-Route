"use client";

import DropzoneUpload from "@/components/DropzoneUpload";
import UploadForm from "@/components/UploadForm";
import { uploadLogo } from "./actions";

// Il logo si carica subito, con l'esito (o l'errore e la sua causa) in vista:
// non dipende dal pulsante "Salva impostazioni" del resto della pagina.
export default function LogoUploader({ logoUrl }: { logoUrl: string | null }) {
  return (
    <section className="mb-6 rounded-xl border border-[#e6d7bb] bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-[#233c5e]">Logo dell&apos;agenzia</h2>
      <p className="mb-4 text-xs text-slate-500">
        Compare nell&apos;intestazione e nella pagina pubblica dei tuoi viaggi. Formati: JPG, PNG, WebP o GIF, fino a 8 MB.
        I colori del logo ti vengono suggeriti qui sotto, come colore del brand.
      </p>
      <div className="flex items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo attuale"
            className="h-20 w-20 shrink-0 rounded-lg border border-[#e6d7bb] bg-white object-contain p-1"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">
            Nessun logo
          </div>
        )}
        <UploadForm action={uploadLogo} className="min-w-0 flex-1">
          <DropzoneUpload name="logo" accept="image/*" label={logoUrl ? "Cambia logo" : "Carica logo"} />
        </UploadForm>
      </div>
    </section>
  );
}
