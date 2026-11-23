import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { DEFAULT_LEVELS, parseLevels } from "@/lib/benefits";
import SubmitButton from "@/components/SubmitButton";
import ConfirmDeleteButton from "@/components/community/ConfirmDeleteButton";
import { addOffer, deleteOffer, saveLoyalty, toggleOffer } from "./actions";

export const metadata = { title: "Vantaggi per i clienti" };

type Offer = { id: string; title: string; body: string | null; valid_until: string | null; active: boolean };

const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]";
const dateIt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

export default async function BenefitsSettingsPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  const [{ data: loyalty, error }, { data: offerRows }] = await Promise.all([
    supabase.from("agency_loyalty").select("*").eq("owner_id", user?.id ?? "").maybeSingle(),
    supabase.from("agency_offers").select("id, title, body, valid_until, active").eq("owner_id", user?.id ?? "").order("created_at", { ascending: false }),
  ]);
  const notReady = Boolean(error);
  const levels = loyalty ? parseLevels(loyalty.levels) : DEFAULT_LEVELS;
  const rows = [...levels, ...Array.from({ length: Math.max(0, 5 - levels.length) }, () => ({ name: "", min: 0, perks: "" }))].slice(0, 5);
  const offers = (offerRows as Offer[] | null) ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/dashboard/settings" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#233c5e]">
          <ArrowLeft size={14} /> Impostazioni
        </Link>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Vantaggi per i clienti</h1>
        <p className="mt-1 text-sm text-slate-600">
          Premia chi viaggia con te: punti fedeltà calcolati da soli sui pagamenti incassati, livelli con vantaggi decisi da te e offerte riservate.
          I clienti li vedono nella loro area, alla voce «Vantaggi».
        </p>
      </div>

      {notReady && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Per attivare questa sezione serve l&apos;aggiornamento del database 0053 (Supabase → SQL Editor).
        </p>
      )}

      <form action={saveLoyalty} className="flex flex-col gap-4 rounded-2xl border border-[#e6d7bb] bg-white p-5">
        <h2 className="text-lg font-semibold text-[#233c5e]">Programma fedeltà</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" name="enabled" defaultChecked={Boolean(loyalty?.enabled)} className="h-4 w-4" />
          Attiva il programma fedeltà per i miei clienti
        </label>
        <label className="text-sm text-slate-700">
          Un punto ogni quanti euro incassati?
          <span className="mt-1 flex items-center gap-2">
            <input name="euros_per_point" type="number" min="1" step="1" defaultValue={Number(loyalty?.euros_per_point ?? 10)} className={`${input} w-28`} />
            <span className="text-slate-500">€ = 1 punto</span>
          </span>
          <span className="mt-1 block text-xs text-slate-500">Si contano i pagamenti dei clienti registrati come pagati, su tutti i loro viaggi.</span>
        </label>
        <label className="text-sm text-slate-700">
          Messaggio di presentazione (facoltativo)
          <textarea name="intro" rows={2} maxLength={1000} defaultValue={loyalty?.intro ?? ""} placeholder="Es. Grazie di viaggiare con noi! Ogni viaggio ti avvicina a un premio." className={`${input} mt-1`} />
        </label>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-800">Livelli (fino a 5)</p>
          <div className="flex flex-col gap-3">
            {rows.map((l, i) => (
              <div key={i} className="grid gap-2 rounded-xl bg-[#faf3e6] p-3 sm:grid-cols-[1fr_110px]">
                <input name={`level_name_${i}`} defaultValue={l.name} placeholder={`Nome del livello ${i + 1}`} maxLength={40} className={input} />
                <input name={`level_min_${i}`} type="number" min="0" defaultValue={l.name ? l.min : ""} placeholder="Da punti" className={input} />
                <input name={`level_perks_${i}`} defaultValue={l.perks} placeholder="Cosa ottiene il cliente a questo livello" maxLength={300} className={`${input} sm:col-span-2`} />
              </div>
            ))}
          </div>
        </div>
        <SubmitButton pendingLabel="Salvo…" className="w-fit rounded-lg bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60">
          Salva il programma
        </SubmitButton>
      </form>

      <section className="flex flex-col gap-4 rounded-2xl border border-[#e6d7bb] bg-white p-5">
        <h2 className="text-lg font-semibold text-[#233c5e]">Offerte riservate</h2>
        <p className="-mt-2 text-sm text-slate-600">Proposte visibili solo ai tuoi clienti (es. sconto sul prossimo viaggio, partenza di gruppo, early booking).</p>
        <form action={addOffer} className="flex flex-col gap-2 rounded-xl bg-[#faf3e6] p-3">
          <input name="title" required minLength={3} maxLength={120} placeholder="Titolo dell'offerta" className={input} />
          <textarea name="body" rows={3} maxLength={2000} placeholder="Dettagli: cosa include, per chi, come richiederla" className={input} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Valida fino al
            <input name="valid_until" type="date" className={`${input} w-auto`} />
          </label>
          <SubmitButton pendingLabel="Pubblico…" className="w-fit rounded-lg bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60">
            Pubblica l&apos;offerta
          </SubmitButton>
        </form>
        {offers.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuna offerta ancora.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {offers.map((o) => (
              <li key={o.id} className="rounded-xl border border-[#e6d7bb] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {o.title} {!o.active && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">nascosta</span>}
                    </p>
                    {o.valid_until && <p className="text-xs text-slate-500">Valida fino al {dateIt(o.valid_until)}</p>}
                    {o.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{o.body}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <form action={toggleOffer.bind(null, o.id, !o.active)}>
                      <button type="submit" className="text-xs font-medium text-[#233c5e] hover:underline">
                        {o.active ? "Nascondi" : "Mostra"}
                      </button>
                    </form>
                    <ConfirmDeleteButton action={deleteOffer.bind(null, o.id)} confirmText="Eliminare questa offerta?" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
