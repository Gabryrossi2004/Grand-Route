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
