import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import SubmitButton from "@/components/SubmitButton";
import CountryChips from "./CountryChips";
import { saveTravelerListing } from "./actions";

export const metadata = { title: "Vetrina per i viaggiatori" };

export default async function TravelerListingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error: err } = await searchParams;
  const supabase = await createClient();
  const user = await getCachedUser();
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user?.id ?? "").maybeSingle();
  const ready = !error && profile && "traveler_listing" in profile;
  const listing = Boolean((profile as { traveler_listing?: boolean } | null)?.traveler_listing);
  const blurb = (profile as { traveler_blurb?: string | null } | null)?.traveler_blurb ?? "";
  const countries = ((profile as { traveler_countries?: string[] | null } | null)?.traveler_countries ?? []) as string[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/dashboard/settings" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#233c5e]">
          <ArrowLeft size={14} /> Impostazioni
        </Link>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Vetrina per i viaggiatori</h1>
        <p className="mt-1 text-sm text-slate-600">
          I viaggiatori che organizzano da soli con Grand Route possono mandare il loro viaggio a un&apos;agenzia perché lo prepari. Se compari in elenco, ricevi la loro richiesta in
          <strong> Clienti → Nuove richieste</strong>, con una <strong>copia del loro itinerario</strong> già pronta tra i tuoi viaggi: un nuovo cliente che arriva con un programma in mano.
        </p>
      </div>

      {!ready && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per attivare questa sezione serve l&apos;aggiornamento del database 0060 (Supabase → SQL Editor).</p>}
      {saved && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Salvato.</p>}
      {err === "nome" && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per comparire in elenco scrivi prima il nome dell&apos;agenzia in Impostazioni.</p>}
      {err === "db" && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Non sono riuscito a salvare. Riprova.</p>}

      <form action={saveTravelerListing} className="flex flex-col gap-4 rounded-2xl border border-[#e6d7bb] bg-white p-5">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" name="listing" defaultChecked={listing} className="h-4 w-4" />
          Mostra la mia agenzia nell&apos;elenco dei viaggiatori
        </label>
        <label className="text-sm text-slate-700">
          Presentazione (cosa fai meglio, per chi lavori)
          <textarea
            name="blurb"
            rows={4}
            maxLength={600}
            defaultValue={blurb}
            placeholder="Es. Agenzia di Roma specializzata in viaggi di nozze e Asia. Rispondiamo entro un giorno lavorativo."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
          />
        </label>
        <div className="text-sm text-slate-700">
          <p className="mb-1">Paesi in cui sei specializzata (i viaggiatori diretti lì ti vedono per prima)</p>
          <CountryChips initial={countries} />
        </div>
        <p className="text-xs text-slate-500">
          I viaggiatori vedono solo il nome dell&apos;agenzia, il logo, il colore, la presentazione e i paesi. Non vedono i tuoi contatti: sono loro a scriverti, con il loro consenso.
        </p>
        <div>
          <SubmitButton pendingLabel="Salvo…" className="rounded-lg bg-[#233c5e] px-5 py-2 text-sm font-semibold text-white hover:bg-[#17283f]">
            Salva
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
