import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, FileText, Globe, Languages, Lock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNetworkUser } from "@/lib/team";
import { nameItOfCode } from "@/lib/geo/countryCodes";
import { kindLabel } from "@/lib/network/kinds";
import { Rating, type NetworkRow } from "@/components/network/ProfileCard";
import { ContactForm, ReviewButtons } from "@/components/network/ContactAndReview";
import CollaborationBox, { type CollabState } from "@/components/network/CollaborationBox";
import NetworkGallery from "@/components/network/NetworkGallery";
import AvailabilityCalendar, { type AvailabilityDay } from "@/components/network/AvailabilityCalendar";
import { addDays, todayRome } from "@/lib/orders/shared";
import { FILES_BUCKET, brandOf, mediaUrl } from "@/lib/network/media";

// Scheda pubblica di un professionista verificato. Nessun recapito: si scrive una richiesta.
export default async function NetworkProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getNetworkUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("network_get", { p_user: id });
  const row = ((data ?? []) as NetworkRow[])[0];
  if (!row) notFound();

  const [{ data: mine }, { data: viewerKind }] = await Promise.all([
    supabase.rpc("network_my_review", { p_reviewed: id }),
    user ? supabase.rpc("network_kind_of", { p_uid: user.id }) : Promise.resolve({ data: null }),
  ]);
  // visita alla scheda, per le statistiche del professionista (una al giorno; se la funzione manca non succede nulla)
  if (user && user.id !== id) void supabase.rpc("network_profile_view", { p_profile: id }).then(() => {}, () => {});
  const canReview = viewerKind != null && viewerKind !== row.kind;
  const isOther = !!user && user.id !== id;

  const todayIso = todayRome();
  const [{ data: collabRows }, { data: fileRows }, { data: availInfo }, { data: availRows }] = await Promise.all([
    isOther ? supabase.rpc("network_collab_status", { p_user: id }) : Promise.resolve({ data: null }),
    supabase.rpc("network_files_of", { p_user: id }),
    // disponibilità condivisa dal professionista con i suoi partner (vuoto se non è un partner o se non la condivide)
    isOther ? supabase.rpc("network_availability_info", { p_user: id }) : Promise.resolve({ data: null }),
    isOther ? supabase.rpc("network_availability", { p_user: id, p_from: todayIso, p_to: addDays(todayIso, 100) }) : Promise.resolve({ data: null }),
  ]);
  const availShared = ((availInfo as { shared: boolean; with_busy: boolean }[] | null)?.[0]) ?? null;
  const collab = ((collabRows ?? []) as NonNullable<CollabState>[])[0] ?? null;
  const fileList = (fileRows ?? []) as { id: string; title: string; path: string; size_bytes: number | null; visibility: string }[];
  const signed = fileList.length ? await supabase.storage.from(FILES_BUCKET).createSignedUrls(fileList.map((f) => f.path), 3600) : null;
  const urlByPath = new Map((signed?.data ?? []).map((u) => [u.path ?? "", u.signedUrl]));

  const brand = brandOf(row.brand_color);
  const cover = mediaUrl(row.cover_path, 1280);
  const logo = mediaUrl(row.logo_path, 300);
  const photos = (row.gallery ?? []).map((g) => ({ thumb: mediaUrl(g, 640) ?? "", full: mediaUrl(g, 1280) ?? "" })).filter((p) => p.thumb);

  return (
    <div>
      <Link href="/rete" className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Torna all&apos;elenco
      </Link>
      <article className="overflow-hidden rounded-3xl border border-[#e6d7bb] bg-white shadow-sm">
        <div className="relative text-white" style={{ background: `linear-gradient(135deg, ${brand}, color-mix(in srgb, ${brand} 65%, #ffffff))` }}>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {cover && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />}
          <div className={`relative flex items-end gap-4 p-6 ${cover ? "min-h-[220px] sm:min-h-[280px]" : ""}`}>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-20 w-20 shrink-0 rounded-2xl border-2 border-white bg-white object-cover shadow-lg" />
            )}
            <div className="min-w-0">
              <p className="text-sm text-white/80">{kindLabel(row.kind)}</p>
              <h1 className="mt-1 flex items-center gap-2 text-3xl text-white">
                <span className="min-w-0">{row.business_name}</span> <BadgeCheck size={24} className="shrink-0 text-[#f2c14e]" aria-label="Verificato" />
              </h1>
              {row.tagline && <p className="mt-1 text-base italic text-white/90">{row.tagline}</p>}
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                <MapPin size={14} /> {row.city}, {nameItOfCode(row.country)}
              </p>
            </div>
          </div>
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
        {(photos.length > 0 || fileList.length > 0) && (
          <div className="space-y-5 border-t border-[#f2e2c4] p-6">
            {photos.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Foto</p>
                <NetworkGallery photos={photos} />
              </div>
            )}
            {fileList.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Listini e documenti</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {fileList.map((f) => {
                    const href = urlByPath.get(f.path);
                    return (
                      <li key={f.id}>
                        {href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-[#e6d7bb] px-3 py-2.5 text-sm font-medium text-[#233c5e] hover:border-[#c58f2d]">
                            <FileText size={18} className="shrink-0 text-[#c58f2d]" /> <span className="min-w-0 flex-1 truncate">{f.title}</span>
                            {f.visibility === "partner" && <span title="Visibile solo ai partner"><Lock size={13} className="shrink-0 text-slate-400" /></span>}
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-slate-500">Alcuni documenti sono riservati ai partner: per vederli proponi una collaborazione.</p>
              </div>
            )}
          </div>
        )}
        {availShared?.shared && (
          <div className="border-t border-[#f2e2c4] p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Disponibilità</p>
            <p className="mb-3 text-sm text-slate-600">{row.business_name} la condivide con i suoi partner. Per essere sicuro, conferma sempre con una richiesta di servizio.</p>
            <AvailabilityCalendar days={(availRows ?? []) as AvailabilityDay[]} today={todayIso} months={3} withBusy={availShared.with_busy} />
          </div>
        )}
        {isOther && (
          <div className="border-t border-[#f2e2c4] bg-[#fffaf0] px-6 pt-6">
            <CollaborationBox toUser={id} name={row.business_name} state={collab} />
          </div>
        )}
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
