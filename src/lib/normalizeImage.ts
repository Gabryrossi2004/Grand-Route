import { EXTENSION_FOR_MIME, sniffMime } from "@/lib/imageSniff";

function withExtension(name: string, extension: string) {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "immagine"}.${extension}`;
}

// Prepara un'immagine scelta dall'utente prima dell'invio:
// - se il contenuto è un formato consentito ma l'estensione/tipo dichiarato è
//   sbagliato (es. un WebP chiamato ".jpg"), corregge nome e tipo;
// - se il formato è uno che il sito non accetta ma il browser sa leggere
//   (es. AVIF, BMP), lo converte in PNG;
// - negli altri casi (PDF, Excel, testo...) lascia il file com'è.
export async function normalizeImageFile(file: File): Promise<File> {
  const looksLikeImage = file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|avif|heic|heif|bmp|tiff?)$/i.test(file.name);
  if (!looksLikeImage) return file;

  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const real = sniffMime(head);
    if (real && real !== "application/pdf") {
      if (real === file.type) return file;
      return new File([file], withExtension(file.name, EXTENSION_FOR_MIME[real]), { type: real });
    }
    if (real === "application/pdf") return file;

    // Formato non consentito: se il browser lo sa decodificare, lo riscrive in PNG.
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return file;
    return new File([blob], withExtension(file.name, "png"), { type: "image/png" });
  } catch {
    return file;
  }
}
