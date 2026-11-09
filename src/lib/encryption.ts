import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Cifra i dati anagrafici/documenti dei clienti (codice fiscale, numero
// carta d'identità/passaporto, indirizzo, data di nascita...) prima di
// salvarli: anche con accesso diretto al database (es. un backup trafugato,
// un bug nelle policy di sicurezza) questi campi restano illeggibili senza
// la chiave, che vive solo nella variabile d'ambiente del server, mai nel
// codice né esposta al browser.
const ALGORITHM = "aes-256-gcm";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "CLIENT_DATA_ENCRYPTION_KEY non configurata: impossibile salvare/leggere i dati anagrafici dei clienti in sicurezza.",
    );
  }
  // scrypt è volutamente lento (protegge da attacchi a forza bruta sulla chiave):
  // calcolato una sola volta per processo, non a ogni campo.
  cachedKey = scryptSync(secret, "grand-route-client-data", 32);
  return cachedKey;
}

export function encryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

// Legge in chiaro un campo cifrato con encryptField. Un valore che non porta
// il prefisso "enc:" è un dato scritto prima dell'attivazione della cifratura
// (o comunque non cifrato): viene restituito così com'è, invece di sparire,
// finché non viene risalvato (a quel punto verrà cifrato).
export function decryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("enc:")) return value;

  const parts = value.split(":");
  if (parts.length !== 4) return null;
  const [, ivB64, authTagB64, dataB64] = parts;

  try {
    const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
