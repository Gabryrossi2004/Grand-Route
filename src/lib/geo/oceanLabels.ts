import type * as THREE_NS from "three";

// Nomi di oceani e mari, scritti come "etichette" curve sopra il globo: ognuna è un piccolo tassello della sfera
// con il proprio testo ad alta risoluzione, quindi restano nitide anche da vicino.
// Posizioni, angoli e dimensioni sono stati calcolati controllando che il testo non tocchi mai le terre emerse.
export type OceanLabel = {
  text: string;
  lon: number; // centro, in gradi
  lat: number;
  size: number; // altezza del carattere in gradi di latitudine
  spacing: number; // spaziatura tra le lettere, in gradi
  angle: number; // inclinazione in gradi (positivo = sale verso destra)
  italicSea?: boolean;
};

export const OCEAN_LABELS: OceanLabel[] = [
  { text: "OCEANO ATLANTICO", lon: -41, lat: 26, size: 3, spacing: 0.9, angle: 0 },
  { text: "OCEANO ATLANTICO", lon: -14, lat: -26, size: 3, spacing: 0.9, angle: -50 },
  { text: "OCEANO PACIFICO", lon: -139, lat: 20, size: 4.2, spacing: 1.6, angle: -16 },
  { text: "OCEANO PACIFICO", lon: -122, lat: -24, size: 4.2, spacing: 1.6, angle: 0 },
  { text: "OCEANO INDIANO", lon: 78, lat: -17, size: 3.4, spacing: 1.3, angle: 0 },
  { text: "OCEANO GLACIALE ANTARTICO", lon: 20, lat: -62, size: 2, spacing: 0.6, angle: 0 },
  { text: "Mar Mediterraneo", lon: 24, lat: 34, size: 1.1, spacing: 0.35, angle: -6, italicSea: true },
  { text: "Mar dei Caraibi", lon: -75, lat: 15, size: 1.1, spacing: 0.3, angle: 0, italicSea: true },
  { text: "Mar Arabico", lon: 64, lat: 14, size: 1.5, spacing: 0.5, angle: 0, italicSea: true },
];

const D2R = Math.PI / 180;

export function buildOceanLabels(T: typeof THREE_NS, fontFamily: string, maxAnisotropy: number): THREE_NS.Group {
  const group = new T.Group();
  const measure = document.createElement("canvas").getContext("2d")!;
  for (const l of OCEAN_LABELS) {
    const chars = [...l.text];
    measure.font = `italic 100px ${fontFamily}`;
    const widthDeg = (chars.reduce((sum, ch) => sum + measure.measureText(ch).width, 0) / 100) * l.size + l.spacing * (chars.length - 1);
    const heightDeg = l.size * 1.35;
    const a = l.angle * D2R;
    const pad = 0.5;
    const bw = Math.abs(widthDeg * Math.cos(a)) + Math.abs(heightDeg * Math.sin(a)) + pad;
    const bh = Math.abs(widthDeg * Math.sin(a)) + Math.abs(heightDeg * Math.cos(a)) + pad;
    const cosLat = Math.cos(l.lat * D2R);
    const dLon = bw / cosLat;
    const dLat = bh;
    const ppd = Math.min(80, 2048 / Math.max(bw, bh)); // pixel per grado di latitudine

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(8, Math.round(bw * ppd));
    canvas.height = Math.max(8, Math.round(bh * ppd));
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-a);
    const fontPx = l.size * ppd;
    ctx.font = `italic ${fontPx.toFixed(1)}px ${fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.lineJoin = "round";
    let total = 0;
    for (const ch of chars) total += ctx.measureText(ch).width + l.spacing * ppd;
    total -= l.spacing * ppd;
    let x = -total / 2;
    for (const ch of chars) {
      // alone chiaro sotto l'inchiostro blu, per leggere bene anche sul colore del mare
      ctx.strokeStyle = "rgba(250,243,222,.55)";
      ctx.lineWidth = fontPx * 0.14;
      ctx.strokeText(ch, x, 0);
      ctx.fillStyle = l.italicSea ? "rgba(24,46,80,.95)" : "rgba(24,46,80,.9)";
      ctx.fillText(ch, x, 0);
      x += ctx.measureText(ch).width + l.spacing * ppd;
    }

    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    const patch = new T.Mesh(
      new T.SphereGeometry(
        1.0008,
        Math.max(8, Math.ceil(dLon / 1.5)),
        Math.max(4, Math.ceil(dLat / 1.5)),
        (l.lon - dLon / 2 + 180) * D2R,
        dLon * D2R,
        (90 - (l.lat + dLat / 2)) * D2R,
        dLat * D2R,
      ),
      new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    group.add(patch);
  }
  return group;
}
