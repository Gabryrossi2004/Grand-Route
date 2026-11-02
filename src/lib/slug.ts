// Genera un codice corto e leggibile da usare nel link pubblico di un viaggio,
// es. https://.../t/a1b2c3d4e5f6
export function generatePublicSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
