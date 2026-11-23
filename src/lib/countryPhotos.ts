// Foto per la scheda paese: immagini libere da Wikipedia / Wikimedia Commons, con autore e licenza
// (obbligatori per legge: le licenze Creative Commons chiedono di citare l'autore).
// Si cercano solo foto con licenza libera (pilicense=free) e si scartano bandiere, mappe e stemmi.

export type SheetPhoto = { url: string; title: string; credit: string; license: string; source: string };

const UA = "GrandRoute/1.0 (https://grandroute.it)";
const SKIP = /flag|bandiera|map|mappa|locator|location|coat[_ ]of[_ ]arms|stemma|emblem|logo|\.svg$|\.gif$|\.tif/i;
// Foto con persone in primo piano (ritratti, folle, mestieri, feste): si scartano guardando nome del file e categorie
const PEOPLE =
  /\b(people|persons?|portraits?|ritratt\w*|men|women|man|woman|girls?|boys?|child|children|kids?|bambin\w*|crowds?|folla|tourists?|turisti|selfie|faces?|dancers?|dancing|musicians?|performers?|vendors?|workers?|fishermen|soldiers?|guards?|wedding|bride|actors?|players?|athletes?|nude|nudity|smiling|couples?|families|monks|nuns|pilgrims|riders?|surfers?|swimmers?|divers?|hikers?|skiers?|politicians?|presidents?|kings?|queens?|engravings?|incisioni|paintings?|dipint\w*|drawings?|lithographs?)\b/i;

// Soggetti poco da cartolina (interni, dettagli, oggetti, mezzi): si scartano
const DULL =
  /\b(interior|inside|indoor|ceiling|detail|details|close-?up|statue|sculpture|relief|inscription|mosaic|fresco|altar|organ|tomb|grave|coin|stamp|plan|drawing|museum|exhibit|door|window|carving|manuscript|plaque|bus|train|aircraft|airplane|helicopter|ship|navy|military|nave|crypt|cloister|stairs|staircase|chandelier|macro|specimen|flower|insect|interno|interni|dettaglio|statua|scultura|affresco|soffitto|portale|navata|cripta|chiostro|museo|sala)\b/i;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA }, signal: AbortSignal.timeout(6000), next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Nome del file dell'immagine principale della voce più pertinente alla ricerca
async function pageImage(query: string, lang: "it" | "en"): Promise<{ file: string; page: string } | null> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=1` +
    `&gsrsearch=${encodeURIComponent(query)}&prop=pageimages&piprop=name&pilicense=free`;
  const data = (await getJson(url)) as { query?: { pages?: Record<string, { title: string; pageimage?: string }> } } | null;
  const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
  if (!page?.pageimage || SKIP.test(page.pageimage)) return null;
  return { file: page.pageimage, page: page.title };
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export async function findCountryPhotos(queries: { query: string; title: string }[], wanted = 4): Promise<SheetPhoto[]> {
  // 1. immagine principale delle voci (una alla volta, per rispettare i limiti di Wikipedia)
  const found: { file: string; title: string }[] = [];
  for (const q of queries) {
    if (found.length >= wanted + 4) break;
    const hit = (await pageImage(q.query, "it")) ?? (await pageImage(q.query, "en"));
    if (hit && !found.some((f) => f.file === hit.file)) found.push({ file: hit.file, title: q.title });
  }
  if (found.length === 0) return [];

  // 2. autore, licenza e versione ridotta (1280 px) in una sola richiesta a Commons
  const titles = found.map((f) => `File:${f.file}`).join("|");
  // Commons prima; se non risponde (limiti di traffico) la stessa richiesta passa da Wikipedia, che espone i file di Commons
  let raw: unknown = null;
  for (const host of ["commons.wikimedia.org", "it.wikipedia.org", "en.wikipedia.org"]) {
    raw = await getJson(`https://${host}/w/api.php?action=query&format=json&prop=imageinfo%7Ccategories&cllimit=max&clshow=!hidden&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=1280&titles=${encodeURIComponent(titles)}`);
    if ((raw as { query?: { pages?: object } } | null)?.query?.pages) break;
  }
  const data = raw as {
    query?: {
      normalized?: { from: string; to: string }[];
      pages?: Record<
        string,
        {
          title: string;
          categories?: { title: string }[];
          imageinfo?: { thumburl?: string; descriptionurl?: string; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> }[];
        }
      >;
    };
  } | null;
  const pages = Object.values(data?.query?.pages ?? {});
  const norm = new Map((data?.query?.normalized ?? []).map((n) => [n.to, n.from]));

  const photos: SheetPhoto[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) continue;
    const original = (norm.get(page.title) ?? page.title).replace(/^File:/, "");
    const match = found.find((f) => f.file === original || f.file.replace(/_/g, " ") === original.replace(/_/g, " "));
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? "");
    if (!license || /fair use|non-free/i.test(license)) continue;
    // solo paesaggi orizzontali, senza persone come soggetto
    if (info.width && info.height && info.width / info.height < 1.2) continue;
    const cats = (page.categories ?? []).map((c) => c.title).join(" ");
    if (PEOPLE.test(`${original} ${cats}`)) continue;
    if (DULL.test(original.replace(/_/g, " "))) continue;
    photos.push({
      url: info.thumburl.replace(/\?.*$/, ""),
      title: match?.title ?? stripHtml(meta.ObjectName?.value ?? ""),
      credit: stripHtml(meta.Artist?.value ?? "Autore sconosciuto")
        .replace(/^No machine-readable author provided\.\s*(.+?)\s+assumed.*$/i, "$1")
        .slice(0, 120),
      license,
      source: info.descriptionurl ?? "https://commons.wikimedia.org",
    });
  }
  // stesso ordine dei luoghi della scheda
  photos.sort((a, b) => queries.findIndex((q) => q.title === a.title) - queries.findIndex((q) => q.title === b.title));
  return photos.slice(0, wanted);
}
