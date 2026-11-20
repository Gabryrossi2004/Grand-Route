import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CountrySheetStoredSchema } from "@/lib/countrySheetAi";
import { librarySheet } from "@/lib/countrySheetLibrary";
import type { SheetPhoto } from "@/lib/countryPhotos";
import { fetchLogoShape, type LogoShape } from "@/lib/logoShape";
import { flagOf, nameItOfCode } from "@/lib/geo/countryCodes";
import CountrySheetView from "@/components/CountrySheetView";
import PrintButton from "./PrintButton";

// Link privato: non si indicizza sui motori di ricerca
export const metadata: Metadata = { title: "Scheda paese", robots: { index: false, follow: false } };

type Shared = {
  country_code: string;
  owner_id: string;
  agency_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  content: unknown;
  photos: SheetPhoto[] | null;
  updated_at: string | null;
};

const RADIUS: Record<LogoShape, string> = { squadrato: "rounded-none", smussato: "rounded-xl", tondo: "rounded-full", personalizzato: "rounded-none" };

// La scheda paese che l'agenzia manda al cliente: nome e logo dell'agenzia, niente consigli riservati né fornitori.
export default async function SharedSheetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_sheet", { p_token: token });
  const shared = data as Shared | null;
  if (!shared) notFound();

  // Versione personalizzata dall'agenzia, altrimenti la scheda della libreria Grand Route
  const custom = CountrySheetStoredSchema.safeParse(shared.content);
  const lib = librarySheet(shared.country_code);
  const content = custom.success ? custom.data : lib?.content;
  if (!content) notFound();
  const photos = custom.success ? (shared.photos ?? []) : (lib?.photos ?? []);

  const shape = await fetchLogoShape(supabase, shared.owner_id);
  const brand = shared.brand_color && /^#[0-9a-f]{6}$/i.test(shared.brand_color) ? shared.brand_color : "#233c5e";
  const name = nameItOfCode(shared.country_code);

  return (
    <main className="min-h-screen bg-[#fbf7ee]">
      <header className="text-white" style={{ background: brand }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
          {shared.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shared.logo_url} alt={shared.agency_name ?? "Agenzia"} className={`h-12 w-12 bg-white/10 object-contain ${RADIUS[shape]}`} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/75">{shared.agency_name ?? "La tua agenzia di viaggi"} · Scheda paese</p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight">
              <span aria-hidden>{flagOf(shared.country_code)}</span> {name}
            </h1>
            {content.tagline && <p className="mt-0.5 text-sm italic text-white/85">{content.tagline}</p>}
          </div>
          <PrintButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl pb-10">
        <CountrySheetView
          content={content}
          photos={photos}
          showAgentTips={false}
          note="Informazioni di carattere generale: prima della partenza verifica sempre documenti, requisiti di ingresso e indicazioni di sicurezza su viaggiaresicuri.it."
        />
      </div>
    </main>
  );
}
