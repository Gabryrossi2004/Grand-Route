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
