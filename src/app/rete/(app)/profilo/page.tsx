import { redirect } from "next/navigation";
import { BadgeCheck, Clock, XCircle } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { getBusinessKind } from "@/lib/network/server";
import { KIND_INFO, KIND_FIELDS, isBusinessKind, isTradeKind, type BusinessKind } from "@/lib/network/kinds";
import ProfileForm from "@/components/network/ProfileForm";
import ShowcaseEditor, { type ShowcaseFile } from "@/components/network/ShowcaseEditor";
import type { Values } from "@/components/network/BusinessFields";

const STATUS: Record<string, { label: string; tone: string; text: string }> = {
  bozza: { label: "Bozza", tone: "bg-slate-100 text-slate-700", text: "Completa i dati e salva per mandare il profilo in verifica." },
  in_verifica: { label: "In verifica", tone: "bg-amber-100 text-amber-800", text: "Stiamo controllando i dati. Quando è verificato compari nell'elenco." },
  verificato: { label: "Verificato", tone: "bg-emerald-100 text-emerald-800", text: "Il tuo profilo è verificato e visibile nell'elenco (se la spunta è attiva)." },
  rifiutato: { label: "Da correggere", tone: "bg-red-100 text-red-800", text: "Il profilo non è stato accettato. Correggi i dati e salva: lo ricontrolliamo." },
  sospeso: { label: "Sospeso", tone: "bg-red-100 text-red-800", text: "Il profilo è sospeso. Scrivici per capire come riattivarlo." },
};

export default async function NetworkProfilePageEdit() {
  const user = await getCachedUser();
  if (!user) redirect("/login?next=/rete/profilo");
  const supabase = await createClient();
  const kindFromProfile = await getBusinessKind();
  const { data: row, error } = await supabase.from("network_profiles").select("*").eq("user_id", user.id).maybeSingle();

  if (error)
    return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per attivare la Rete serve l&apos;aggiornamento del database (migrazione 0061, in Supabase → SQL Editor).</p>;

  const r = row as (Record<string, unknown> & { kind?: string; status?: string; status_note?: string | null; listed?: boolean; kind_data?: Record<string, string | string[]> }) | null;
  const kind: BusinessKind = (isBusinessKind(r?.kind) ? r.kind : kindFromProfile) ?? "agenzia";

  const values: Values = {};
  if (r) {
    for (const k of ["business_name", "legal_form", "country", "vat_number", "tax_code", "sdi_code", "pec", "address", "postal_code", "city", "province", "phone", "website", "description"]) {
      values[k] = (r[k] as string | null) ?? "";
    }
    for (const k of ["countries_served", "languages", "specialties"]) values[k] = (r[k] as string[]) ?? [];
    for (const f of KIND_FIELDS[kind]) {
      const v = r.kind_data?.[f.key];
      if (v !== undefined) values[`kd_${f.key}`] = v;
    }
  }
  const st = r?.status ? STATUS[r.status] : null;
  const showcaseReady = !!r && "gallery" in r;
  let files: ShowcaseFile[] = [];
  if (showcaseReady) {
    const { data: fileRows } = await supabase.from("network_files").select("id, title, path, size_bytes, visibility").eq("user_id", user.id).order("created_at", { ascending: false });
    files = (fileRows ?? []) as ShowcaseFile[];
  }

  return (
    <div>
      <p className="eyebrow">Rete professionale</p>
      <h1 className="mt-1 text-3xl text-[#233c5e]">Il mio profilo</h1>
      <p className="mt-2 max-w-xl text-base text-slate-600">
        {KIND_INFO[kind].label}. Partita IVA, indirizzo e recapiti non compaiono nell&apos;elenco: li usiamo per verificarti e per la fattura.
      </p>
      {st ? (
        <div className={`mt-4 flex items-start gap-3 rounded-2xl p-4 ${st.tone}`}>
          {r?.status === "verificato" ? <BadgeCheck size={20} /> : r?.status === "in_verifica" || r?.status === "bozza" ? <Clock size={20} /> : <XCircle size={20} />}
          <div>
            <p className="font-semibold">{st.label}</p>
            <p className="text-sm">{st.text}</p>
            {r?.status_note && <p className="mt-1 text-sm italic">Nota del team: {r.status_note}</p>}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-[#faf3e6] p-4 text-sm text-slate-700">Non hai ancora un profilo nella Rete: compilalo per comparire nell&apos;elenco dopo la verifica.</p>
      )}
      {r && (
        <div className="mt-6">
          {showcaseReady ? (
            <ShowcaseEditor
              userId={user.id}
              data={{
                cover_path: (r.cover_path as string | null) ?? null,
                logo_path: (r.logo_path as string | null) ?? null,
                tagline: (r.tagline as string | null) ?? null,
                brand_color: (r.brand_color as string | null) ?? null,
                gallery: (r.gallery as string[] | null) ?? [],
              }}
              files={files}
            />
          ) : (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per personalizzare la vetrina (copertina, foto, listini) serve l&apos;aggiornamento del database 0064.</p>
          )}
        </div>
      )}
      {!r && (
        <div className="mt-6 rounded-2xl border border-dashed border-[#c58f2d] bg-white p-5">
          <p className="text-base font-semibold text-[#233c5e]">Copertina, logo, foto e listini</p>
          <p className="mt-1 text-sm text-slate-600">
            Si sbloccano appena salvi i dati dell&apos;attività qui sotto: compila il modulo, premi <strong>Salva il profilo</strong> e questa sezione compare sopra.
          </p>
        </div>
      )}
      <h2 className="mt-8 text-xl font-semibold text-[#233c5e]">Dati dell&apos;attività</h2>
      <div className="mt-3">
        <ProfileForm kind={kind} kindLocked={!!kindFromProfile && !isTradeKind(kindFromProfile)} values={values} listed={r?.listed ?? true} />
      </div>
    </div>
  );
}

