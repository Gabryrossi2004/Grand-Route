import { createClient } from "@/lib/supabase/server";
import { countryOptions, nameItOfCode } from "@/lib/geo/countryCodes";
import { BUSINESS_KINDS, KIND_INFO } from "@/lib/network/kinds";
import ProfileCard, { type NetworkRow } from "@/components/network/ProfileCard";
import PartnerSearchBar from "@/components/network/PartnerSearchBar";
import { matchesWords, parseSearch } from "@/lib/network/search";

// Elenco dei professionisti verificati: si cerca per paese, tipo di attività o parola.
// Email e telefono non si vedono: si scrive una richiesta e chi riceve risponde.
export default async function NetworkHome({ searchParams }: { searchParams: Promise<{ q?: string; paese?: string; tipo?: string }> }) {
  const { q = "", paese = "", tipo = "" } = await searchParams;
  const supabase = await createClient();
  // Dalle parole capisce paese e tipo di attività; le altre parole devono comparire tutte nel profilo
  const parsed = parseSearch(q);
  const country = paese || parsed.country || null;
  const kind = tipo || parsed.kind || null;
  const longest = [...parsed.words].sort((a, b) => b.length - a.length)[0] ?? null;
  const search = (query: string | null) =>
    supabase.rpc("network_search", { p_query: query, p_country: country, p_kind: kind, p_limit: 60, p_offset: 0 });
  let { data, error } = await search(longest);
  // la parola può stare in un campo che il database non guarda (lingue, slogan, nome del paese): si filtra qui
  if (!error && longest && (data ?? []).length === 0) ({ data, error } = await search(null));
  const rows = ((data ?? []) as NetworkRow[]).filter((r) => matchesWords(r, parsed.words));
  const countries = countryOptions();
  const understood = [
    ...(!tipo && parsed.kind ? [KIND_INFO[parsed.kind].label] : []),
    ...(!paese && parsed.country ? [nameItOfCode(parsed.country)] : []),
  ];

  return (
    <div>
      <p className="eyebrow">Partner</p>
      <h1 className="mt-1 text-3xl text-[#233c5e] sm:text-4xl">Trova chi ti serve, in ogni paese</h1>
      <p className="mt-2 max-w-xl text-base text-slate-600">
        Guide, autisti, strutture, agenzie locali e tour operator verificati. Le valutazioni sono anonime e i contatti restano riservati.
      </p>

      <PartnerSearchBar
        q={q}
        paese={paese}
        tipo={tipo}
        countries={countries}
        kinds={BUSINESS_KINDS.map((k) => ({ value: k, label: KIND_INFO[k].label }))}
      >
        {understood.length > 0 && !error && (
          <p className="mt-3 text-sm text-slate-600">
            Cerco: {understood.map((u) => <span key={u} className="mr-1.5 rounded-full bg-[#233c5e]/10 px-2 py-0.5 font-medium text-[#233c5e]">{u}</span>)}
            {parsed.words.length > 0 && <span className="text-slate-500">con «{parsed.words.join(" ")}»</span>}
          </p>
        )}
        {error ? (
          <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Per attivare la sezione Partner serve l&apos;aggiornamento del database (migrazione 0061, in Supabase → SQL Editor).
          </p>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#e6d7bb] bg-white/60 p-8 text-center text-slate-600">
            <p className="text-lg font-medium text-[#233c5e]">Nessun professionista trovato</p>
            <p className="mt-1 text-sm">
              {q || paese || tipo
                ? "Prova con meno parole o togli un filtro."
                : "La sezione Partner è appena partita: i profili compaiono dopo la verifica. Torna tra qualche giorno."}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-5 text-sm text-slate-500">{rows.length === 1 ? "1 professionista" : `${rows.length} professionisti`}</p>
            <div className="mt-2 grid gap-3">
              {rows.map((r) => (
                <ProfileCard key={r.user_id} row={r} />
              ))}
            </div>
          </>
        )}
      </PartnerSearchBar>
    </div>
  );
}
