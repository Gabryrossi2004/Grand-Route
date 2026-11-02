import DOMPurify from "isomorphic-dompurify";

// Pulisce l'HTML prodotto dall'editor di testo prima di mostrarlo, così anche
// se qualcuno inserisse codice malevolo non verrebbe eseguito nel browser
// di chi visita la pagina pubblica del viaggio.
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "strong", "em", "ul", "ol", "li", "br"],
    ALLOWED_ATTR: [],
  });
}
