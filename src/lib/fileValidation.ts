import { sniffMime, type SniffedMime } from "@/lib/imageSniff";

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

// Il tipo di file dichiarato dal browser (file.type) viene dall'estensione,
// e un file può avere l'estensione sbagliata senza colpa (capita spesso con
// immagini salvate da generatori AI o da WhatsApp: ".jpg" ma contenuto WebP).
// Qui guardiamo i primi byte del contenuto vero: si accetta qualunque formato
// consentito (JPG, PNG, GIF, WebP e, dove previsto, PDF) e si rifiuta tutto il
// resto (HTML, script, programmi...) anche se si dichiara "image/png".
export async function detectFileMime(file: Blob): Promise<SniffedMime | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return sniffMime(head);
}

export async function verifyFileSignature(file: File, allowPdf = false): Promise<string | null> {
  const detected = await detectFileMime(file);
  if (!detected) {
    return allowPdf
      ? "Formato non riconosciuto: usa una foto (JPG, PNG, WebP, GIF) oppure un PDF."
      : "Formato non riconosciuto: usa una foto JPG, PNG, WebP o GIF.";
  }
  if (detected === "application/pdf" && !allowPdf) {
    return "Qui serve una foto (JPG, PNG, WebP o GIF), non un PDF.";
  }
  return null;
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
