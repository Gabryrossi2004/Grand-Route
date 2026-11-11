// Le foto scattate da telefono arrivano spesso a 4-6000px e diversi MB: molto
// più di quanto serva per essere mostrate in galleria o come copertina, e
// quel peso si traduce in secondi di attesa durante l'upload (soprattutto
// con la distanza di rete tra server e database). Qui le ridimensioniamo e
// ricomprimiamo nel browser PRIMA di inviarle, cosa che non tocca per nulla
// documenti scansionati (serve leggerli per intero) o le foto caricate per
// l'analisi AI (serve la massima definizione del testo).
//
// Se qualcosa va storto (formato non decodificabile dal browser, es. alcuni
// HEIC su Chrome/Firefox) si usa il file originale invece di bloccare
// l'upload.
export async function compressImageFile(file: File, maxDimension = 1920, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size < 400 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^./]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
