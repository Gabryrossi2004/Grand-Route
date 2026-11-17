// Prepara un logo "a ricalco": toglie lo sfondo bianco collegato ai bordi
// (lo rende trasparente) e ritaglia lo spazio vuoto intorno al disegno.
// Il bianco dentro il logo (lettere, dettagli) non viene toccato.
const MAX_SIDE = 1024;
const WHITE_MIN = 238; // un pixel con R,G,B tutti sopra questa soglia è "bianco"

function nameAsPng(name: string) {
  return `${name.replace(/\.[^./\\]+$/, "") || "logo"}.png`;
}

export type TrimResult = { blob: Blob; changed: boolean };

export async function trimLogoBitmap(source: ImageBitmap): Promise<TrimResult | null> {
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  const isBackground = (i: number) => d[i + 3] < 12 || (d[i] >= WHITE_MIN && d[i + 1] >= WHITE_MIN && d[i + 2] >= WHITE_MIN);

  // Riempimento dai bordi: solo il bianco/trasparente collegato all'esterno
  let removed = 0; // pixel visibili resi trasparenti
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (seen[p] || !isBackground(p * 4)) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    if (d[p * 4 + 3] >= 12) removed++;
    d[p * 4 + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // immagine tutta bianca: non si tocca

  ctx.putImageData(img, 0, 0);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  if (!blob) return null;
  const cropped = out.width < w * 0.98 || out.height < h * 0.98;
  return { blob, changed: cropped || removed > w * h * 0.005 };
}

// Se qualcosa non va (formato non leggibile...) restituisce il file originale.
export async function trimLogoFile(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const result = await trimLogoBitmap(bitmap);
    bitmap.close();
    if (!result) return file;
    return new File([result.blob], nameAsPng(file.name), { type: "image/png" });
  } catch {
    return file;
  }
}

// Scarica un logo già caricato e lo ritaglia. Restituisce null se non si può
// leggere; "changed" dice se c'era davvero sfondo o spazio vuoto da togliere.
export async function trimLogoFromUrl(url: string): Promise<{ file: File; changed: boolean } | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const result = await trimLogoBitmap(bitmap);
    bitmap.close();
    if (!result) return null;
    return { file: new File([result.blob], "logo.png", { type: "image/png" }), changed: result.changed };
  } catch {
    return null;
  }
}
