// Riconosce il formato vero di un file dai suoi primi byte (la "firma"),
// senza fidarsi di estensione o tipo dichiarato dal browser. Usato sia nel
// browser (per sistemare file con l'estensione sbagliata) sia sul server
// (per verificare cosa viene davvero caricato).
export type SniffedMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";

function startsWith(head: Uint8Array, bytes: number[], offset = 0) {
  return head.length >= offset + bytes.length && bytes.every((byte, i) => head[offset + i] === byte);
}

export function sniffMime(head: Uint8Array): SniffedMime | null {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return "image/gif"; // "GIF8"
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // "RIFF....WEBP"
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // "%PDF-"
  return null;
}

export const EXTENSION_FOR_MIME: Record<SniffedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
