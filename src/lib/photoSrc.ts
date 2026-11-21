// Le foto di Wikimedia si salvano a 1280 px; nelle schede si mostrano a 960 px (misura standard già pronta su Wikimedia),
// quasi la metà dei byte da scaricare con la stessa resa nel riquadro.
export function photoSrc(url: string, width = 960): string {
  return url.replace(/(\/thumb\/.+\/)\d+px-([^/]+)$/, `$1${width}px-$2`);
}
