// Ricava i colori principali di un'immagine (il logo dell'agenzia) per
// suggerirli come colore del brand. Funziona nel browser: disegna il logo in
// miniatura e conta i colori più frequenti, scartando bianco e trasparenze e
// tenendo solo colori ben distinti tra loro.

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export async function extractLogoPalette(url: string, maxColors = 4): Promise<string[]> {
  try {
    const img = new Image();
    // Serve per poter leggere i pixel di un'immagine ospitata altrove.
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("immagine non leggibile"));
      img.src = url;
    });

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // Raggruppa i pixel in "secchielli" di colori simili (16 livelli per canale).
    const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 128) continue;
      if (r > 245 && g > 245 && b > 245) continue; // bianco/sfondo chiaro
      opaque++;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
    if (opaque === 0) return [];

    const candidates = Array.from(buckets.values())
      .filter((bucket) => bucket.count / opaque >= 0.02) // almeno il 2% dei pixel
      .sort((a, b) => b.count - a.count)
      .map((bucket) => [bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count] as [number, number, number]);

    const chosen: [number, number, number][] = [];
    for (const color of candidates) {
      if (chosen.every((other) => distance(other, color) > 70)) chosen.push(color);
      if (chosen.length >= maxColors) break;
    }
    return chosen.map(([r, g, b]) => toHex(r, g, b));
  } catch {
    return [];
  }
}
