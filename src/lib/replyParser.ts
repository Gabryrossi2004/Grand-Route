import type { ServiceStatus } from "./types";

export type ParsedReply = {
  confirmationNumber: string | null;
  amount: number | null;
  suggestedStatus: ServiceStatus | null;
};

// Estrazione leggera, euristica (nessuna chiamata esterna): cerca pattern
// comuni nelle risposte dei fornitori in italiano. Non pretende di essere
// perfetta: è un punto di partenza che l'agente controlla e corregge
// sempre prima di applicarlo (mai automatico "alla cieca").
export function parseSupplierReply(text: string): ParsedReply {
  const normalized = text.replace(/\s+/g, " ").trim();

  const confirmationPatterns = [
    /(?:numero di conferma|n\.?\s*conferma|codice conferma|conferma)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,14})/i,
    /(?:prenotazione|booking)\s*(?:n\.?|numero|number|id|rif\.?)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,14})/i,
    /\b(?:rif\.?|riferimento|pnr)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,14})/i,
  ];
  let confirmationNumber: string | null = null;
  for (const pattern of confirmationPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      confirmationNumber = match[1].toUpperCase();
      break;
    }
  }

  const amountPatterns = [
    /(?:totale|importo|prezzo|costo)\s*[:\-]?\s*€?\s*(\d{1,6}(?:[.,]\d{2})?)/i,
    /€\s*(\d{1,6}(?:[.,]\d{2})?)/,
    /(\d{1,6}(?:[.,]\d{2})?)\s*€/,
  ];
  let amount: number | null = null;
  for (const pattern of amountPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const raw = match[1].replace(",", ".");
      const value = Number(raw);
      if (!Number.isNaN(value)) {
        amount = value;
        break;
      }
    }
  }

  const lower = normalized.toLowerCase();
  let suggestedStatus: ServiceStatus | null = null;
  if (/\b(confermiam|confermat|disponibil|prenotazione effettuat|booking confirmed)\w*/.test(lower)) {
    suggestedStatus = "confermato";
  } else if (/\b(non\s+disponibil|esaurit|annullat|cancellat|impossibile accontentar)\w*/.test(lower)) {
    suggestedStatus = "cancellato";
  }

  return { confirmationNumber, amount, suggestedStatus };
}
