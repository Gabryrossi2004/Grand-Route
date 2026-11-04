import sanitizeHtmlLib from "sanitize-html";

// Pulisce l'HTML prodotto dall'editor di testo prima di mostrarlo, così anche
// se qualcuno inserisse codice malevolo non verrebbe eseguito nel browser
// di chi visita la pagina pubblica del viaggio.
// Usa "sanitize-html" (non isomorphic-dompurify): quest'ultimo si appoggia a
// jsdom lato server, che in produzione su Vercel andava in crash per un
// problema di compatibilità ESM/CommonJS in una sua dipendenza interna.
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: [
      "p",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "br",
      "a",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  });
}
