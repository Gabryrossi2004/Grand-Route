import { photoSrc } from "@/lib/photoSrc";

// Foto e documenti della vetrina nella Rete.
export const MEDIA_BUCKET = "network-media"; // foto pubbliche (copertina, logo, galleria)
export const FILES_BUCKET = "network-files"; // listini e documenti riservati

export const BRAND_COLORS = [
  { value: "#233c5e", label: "Blu notte" },
  { value: "#c58f2d", label: "Oro" },
  { value: "#2f6b4f", label: "Verde bosco" },
  { value: "#b0563a", label: "Terracotta" },
  { value: "#6b3f69", label: "Prugna" },
  { value: "#1f6f78", label: "Petrolio" },
] as const;
export const DEFAULT_BRAND = BRAND_COLORS[0].value;
export const brandOf = (hex: string | null | undefined): string => (BRAND_COLORS.some((c) => c.value === hex) ? (hex as string) : DEFAULT_BRAND);

// Wikimedia serve solo alcune misure (le altre vengono rifiutate): si sceglie la più vicina verso l'alto
const WIKIMEDIA_WIDTHS = [250, 330, 500, 960, 1280, 1920];
const wikimediaWidth = (w: number) => WIKIMEDIA_WIDTHS.find((x) => x >= w) ?? 1920;

// Percorso salvato nel profilo → indirizzo della foto. I profili di prova usano indirizzi completi di Wikimedia.
export function mediaUrl(path: string | null | undefined, width = 960): string | null {
  if (!path) return null;
  if (/^https:\/\//i.test(path)) return photoSrc(path, wikimediaWidth(width));
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

export const MAX_GALLERY = 8;
export const MAX_FILES = 10;
