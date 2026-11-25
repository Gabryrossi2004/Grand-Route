import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Globe, Languages, MapPin } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { nameItOfCode } from "@/lib/geo/countryCodes";
import { kindLabel } from "@/lib/network/kinds";
import { Rating, type NetworkRow } from "@/components/network/ProfileCard";
import { ContactForm, ReviewButtons } from "@/components/network/ContactAndReview";

// Scheda pubblica di un professionista verificato. Nessun recapito: si scrive una richiesta.
export default async function NetworkProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getCachedUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("network_get", { p_user: id });
  const row = ((data ?? []) as NetworkRow[])[0];
  if (!row) notFound();

  const [{ data: mine }, { data: viewerKind }] = await Promise.all([
    supabase.rpc("network_my_review", { p_reviewed: id }),
    user ? supabase.rpc("network_kind_of", { p_uid: user.id }) : Promise.resolve({ data: null }),
  ]);
  const canReview = viewerKind != null && viewerKind !== row.kind;

  return (
    <div>
      <Link href="/rete" className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Torna all&apos;elenco
      </Link>
      <article className="overflow-hidden rounded-3xl border border-[#e6d7bb] bg-white shadow-sm">
        <div className="bg-gradient-to-br from-[#233c5e] to-[#34527c] p-6 text-white">
          <p className="text-sm text-white/70">{kindLabel(row.kind)}</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl text-white">
            {row.business_name} <BadgeCheck size={24} className="shrink-0 text-[#f2c14e]" aria-label="Verificato" />
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
            <MapPin size={14} /> {row.city}, {nameItOfCode(row.country)}
          </p>
        </div>
        <div className="grid gap-6 p-6 sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <p className="whitespace-pre-line text-base leading-relaxed text-slate-700">{row.description}</p>
            {row.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {row.specialties.map((s) => (
                  <span key={s} className="rounded-full border border-[#e6d7bb] px-3 py-1.5 text-xs text-[#233c5e]">{s}</span>
                ))}
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Paesi in cui opera</p>
              <div className="flex flex-wrap gap-1.5">
                {row.countries_served.map((c) => (
                  <span key={c} className="rounded-full bg-[#faf3e6] px-2.5 py-1 text-xs font-medium text-[#233c5e]">{nameItOfCode(c)}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4 text-sm text-slate-700">
            <p className="flex gap-2"><Languages size={16} className="mt-0.5 shrink-0 text-[#c58f2d]" /> {row.languages.join(", ")}</p>
            {row.website && (
              <p className="flex gap-2">
                <Globe size={16} className="mt-0.5 shrink-0 text-[#c58f2d]" />
                <a href={row.website} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-[#233c5e] hover:underline">{row.website.replace(/^https?:\/\//, "")}</a>
              </p>
            )}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Valutazioni</p>
              <Rating row={row} big />
            </div>
          </div>
        </div>
        <div className="grid gap-6 border-t border-[#f2e2c4] bg-[#fffaf0] p-6 sm:grid-cols-2">
          {user && user.id !== id ? <ContactForm toUser={id} name={row.business_name} /> : <p className="text-sm text-slate-500">Questo è il tuo profilo.</p>}
          {user && user.id !== id && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">La tua valutazione</p>
              <ReviewButtons reviewed={id} mine={typeof mine === "boolean" ? mine : null} canReview={canReview} />
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
