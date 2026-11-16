// Utilità per usare il colore del brand scelto dall'agenzia senza rischi:
// valida il valore e, quando serve scritta bianca sopra, lo scurisce quanto
// basta perché si legga bene (un beige chiaro con testo bianco sarebbe
// illeggibile).

const HEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizeHex(value: string | null | undefined): string | null {
  return value && HEX.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function toRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string) {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastWithWhite(hex: string) {
  return 1.05 / (luminance(hex) + 0.05);
}

// Mescola due colori: amount 0 = a, 1 = b.
export function mixColors(a: string, b: string, amount: number) {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount]);
}

// Restituisce il colore scurito il minimo necessario perché il testo bianco
// sopra abbia un contrasto leggibile (almeno 4.5:1).
export function darkenForWhiteText(hex: string, minContrast = 4.5): string {
  let color = hex;
  for (let step = 0; step < 20 && contrastWithWhite(color) < minContrast; step++) {
    color = mixColors(color, "#000000", 0.1);
  }
  return color;
}
