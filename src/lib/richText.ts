// Classe condivisa per far sembrare uguale il testo formattato (grassetto, elenchi, ecc.)
// sia mentre lo si modifica sia quando viene mostrato in sola lettura, visto che
// Tailwind di base toglie gli stili predefiniti di liste/titoli.
export const richTextClassName =
  "text-sm text-slate-700 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5";

// Le descrizioni create prima dell'editor di testo formattato sono testo semplice,
// non HTML. Le riconosciamo e le "proteggiamo" (scappiamo i caratteri speciali)
// così continuano a essere mostrate correttamente invece di rompere il rendering.
function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function toSafeHtml(raw: string | null | undefined): string {
  if (!raw) return "";
  if (looksLikeHtml(raw)) return raw;
  const escaped = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}
