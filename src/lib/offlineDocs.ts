"use client";

// Documenti salvati sul telefono per usarli senza rete (biglietti, voucher).
// Si usa la memoria "Cache Storage" del browser, accessibile solo da questo
// sito; tutto viene cancellato quando il cliente esce dall'account.
const CACHE_NAME = "gr-docs-v1";
const INDEX_KEY = "gr:offline-docs";

export type OfflineDocMeta = { id: string; name: string; savedAt: string };

function readIndex(): Record<string, OfflineDocMeta> {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeIndex(index: Record<string, OfflineDocMeta>) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* memoria piena o bloccata */
  }
}

export function offlineSupported() {
  return typeof caches !== "undefined";
}

export function listOfflineDocs(): Record<string, OfflineDocMeta> {
  return readIndex();
}

const keyFor = (id: string) => `/offline-doc/${id}`;

export async function saveOfflineDoc(id: string, name: string, url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("download");
  const blob = await response.blob();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    keyFor(id),
    new Response(blob, { headers: { "Content-Type": blob.type || "application/octet-stream" } }),
  );
  const index = readIndex();
  index[id] = { id, name, savedAt: new Date().toISOString() };
  writeIndex(index);
}

export async function removeOfflineDoc(id: string): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(keyFor(id));
  const index = readIndex();
  delete index[id];
  writeIndex(index);
}

// Apre la copia salvata in una nuova scheda
export async function openOfflineDoc(id: string): Promise<boolean> {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(keyFor(id));
  if (!response) return false;
  const blob = await response.blob();
  window.open(URL.createObjectURL(blob), "_blank");
  return true;
}

// Da chiamare all'uscita dall'account: niente resta sul telefono.
export async function clearOfflineData(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      await Promise.all((await caches.keys()).filter((k) => k.startsWith("gr-")).map((k) => caches.delete(k)));
    }
    localStorage.removeItem(INDEX_KEY);
  } catch {
    /* niente da pulire */
  }
}
