const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOCUMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, "application/pdf"];

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

function validateFile(
  file: File,
  allowedMimeTypes: string[],
  maxSizeBytes: number,
): string | null {
  if (!allowedMimeTypes.includes(file.type)) {
    return "Tipo di file non supportato.";
  }
  if (file.size > maxSizeBytes) {
    return `Il file supera la dimensione massima di ${Math.floor(maxSizeBytes / (1024 * 1024))}MB.`;
  }
  return null;
}

export function validateImageFile(file: File): string | null {
  return validateFile(file, IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES);
}

export function validateDocumentFile(file: File): string | null {
  return validateFile(file, DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES);
}

const SPREADSHEET_EXTENSIONS = [".xlsx", ".csv"];
const MAX_SPREADSHEET_SIZE_BYTES = 5 * 1024 * 1024;

// Qui controlliamo l'estensione invece del mime type: per Excel/CSV il mime
// type che manda il browser è poco affidabile (varia per sistema operativo
// e a volte è vuoto), mentre l'estensione è quello che l'utente vede e sceglie.
export function validateSpreadsheetFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!SPREADSHEET_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "Formato non supportato: usa un file .xlsx o .csv.";
  }
  if (file.size > MAX_SPREADSHEET_SIZE_BYTES) {
    return `Il file supera la dimensione massima di ${Math.floor(MAX_SPREADSHEET_SIZE_BYTES / (1024 * 1024))}MB.`;
  }
  return null;
}

const TEXT_FILE_EXTENSIONS = [".txt", ".md"];
const MAX_TEXT_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export function validateTextFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!TEXT_FILE_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "Formato non supportato: usa un file .txt o .md.";
  }
  if (file.size > MAX_TEXT_FILE_SIZE_BYTES) {
    return `Il file supera la dimensione massima di ${Math.floor(MAX_TEXT_FILE_SIZE_BYTES / (1024 * 1024))}MB.`;
  }
  return null;
}

// Il tipo di file dichiarato dal browser (file.type) lo decide chi carica:
// un file qualsiasi può dichiararsi "image/png". Qui guardiamo i primi byte
// del contenuto vero ("firma" del formato) e rifiutiamo se non corrispondono.
function startsWith(head: Uint8Array, bytes: number[], offset = 0) {
  return bytes.every((byte, i) => head[offset + i] === byte);
}

export async function verifyFileSignature(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  let ok: boolean;
  switch (file.type) {
    case "image/jpeg":
      ok = startsWith(head, [0xff, 0xd8, 0xff]);
      break;
    case "image/png":
      ok = startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      break;
    case "image/gif":
      ok = startsWith(head, [0x47, 0x49, 0x46, 0x38]); // "GIF8"
      break;
    case "image/webp":
      ok = startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8); // "RIFF....WEBP"
      break;
    case "application/pdf":
      ok = startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
      break;
    default:
      return "Tipo di file non supportato.";
  }
  return ok ? null : "Il contenuto del file non corrisponde al suo tipo: usa una foto o un PDF valido.";
}

// Nome file sicuro da usare nel percorso dello Storage: solo lettere, numeri,
// punto, trattino e underscore (accenti, spazi e simboli possono far fallire
// il caricamento o creare percorsi strani). Il nome originale resta
// comunque salvato a parte, per essere mostrato all'utente.
export function safeStorageName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-80);
  return cleaned || "file";
}
