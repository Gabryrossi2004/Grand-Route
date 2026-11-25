import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { countryOptions } from "@/lib/geo/countryCodes";
import { BUSINESS_KINDS, KIND_INFO } from "@/lib/network/kinds";
import ProfileCard, { type NetworkRow } from "@/components/network/ProfileCard";

const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";

// Elenco dei professionisti verificati: si cerca per paese, tipo di attività o parola.
// Email e telefono non si vedono: si scrive una richiesta e chi riceve risponde.
export default async function NetworkHome({ searchParams }: { searchParams: Promise<{ q?: string; paese?: string; tipo?: string }> }) {
  const { q = "", paese = "", tipo = "" } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_search", { p_query: q.trim() || null, p_country: paese || null, p_kind: tipo || null, p_limit: 40, p_offset: 0 });
  const rows = (data ?? []) as NetworkRow[];
  const countries = countryOptions();

  return (
    <div>
      <p className="eyebrow">Rete professionale</p>
      <h1 className="mt-1 text-3xl text-[#233c5e] sm:text-4xl">Trova chi ti serve, in ogni paese</h1>
      <p className="mt-2 max-w-xl text-base text-slate-600">
        Guide, autisti, strutture, agenzie locali e tour operator verificati. Le valutazioni sono anonime e i contatti restano riservati.
      </p>

      <form className="mt-5 grid gap-2 rounded-2xl border border-[#e6d7bb] bg-white p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Nome, città o specializzazione" className={input} />
        <select name="paese" defaultValue={paese} className={input} aria-label="Paese">
          <option value="">Tutti i paesi</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <select name="tipo" defaultValue={tipo} className={input} aria-label="Tipo di attività">
          <option value="">Tutte le attività</option>
          {BUSINESS_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_INFO[k].label}</option>
          ))}
        </select>
        <button type="submit" className="flex items-center justify-center gap-2 rounded-lg bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f]">
          <Search size={16} /> Cerca
        </button>
      </form>

      {error ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Per attivare la Rete serve l&apos;aggiornamento del database (migrazione 0061, in Supabase → SQL Editor).
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#e6d7bb] bg-white/60 p-8 text-center text-slate-600">
          <p className="text-lg font-medium text-[#233c5e]">Nessun professionista trovato</p>
          <p className="mt-1 text-sm">La Rete è appena partita: i profili compaiono dopo la verifica. Prova con meno filtri, oppure torna tra qualche giorno.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {rows.map((r) => (
            <ProfileCard key={r.user_id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
