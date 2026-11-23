import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeHex, darkenForWhiteText } from "@/lib/brandColor";
import ReferralForm from "./ReferralForm";
import { sendReferral } from "./actions";

export const metadata = { title: "Un invito a viaggiare", robots: { index: false } };

type Info = { agency_name: string | null; logo_url: string | null; brand_color: string | null; friend: string | null };

// Pagina pubblica del link «presenta un amico»: l'amico lascia i suoi contatti all'agenzia
export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[0-9a-f]{12}$/.test(code)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("referral_info", { p_code: code });
  const info = data as Info | null;
  if (!info) notFound();
  const agency = info.agency_name || "La nostra agenzia";
  const brand = sanitizeHex(info.brand_color);
  const head = brand ? darkenForWhiteText(brand) : "#233c5e";

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#faf3e6] via-[#f7efdd] to-[#edddb8] px-4 py-10">
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="px-6 py-8 text-white" style={{ backgroundColor: head }}>
          {info.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.logo_url} alt="" className="mb-4 h-14 w-14 rounded-xl bg-white object-contain p-1.5" />
          )}
          <p className="text-sm text-white/80">{info.friend ? `${info.friend} ti ha invitato` : "Sei stato invitato"}</p>
          <h1 className="mt-1 text-2xl font-semibold">Il tuo prossimo viaggio con {agency}</h1>
          <p className="mt-2 text-sm text-white/85">
            Lascia i tuoi contatti: l&apos;agenzia ti chiamerà per costruire con te un viaggio su misura, con assistenza prima, durante e dopo la partenza.
          </p>
        </div>
        <div className="p-6">
          <ReferralForm action={sendReferral.bind(null, code)} agency={agency} />
        </div>
      </div>
    </main>
  );
}
