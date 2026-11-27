import Link from "next/link";
import { ArrowLeft, Gift, Users } from "lucide-react";
import InviteShare from "@/components/InviteShare";
import { MAX_BANKED_MONTHS, REWARD_MONTHS, REWARD_PCT, STATE_LABEL, type ReferralOverview } from "@/lib/referral";

const dayIt = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

// Pagina «Invita un collega» (agenzie e fornitori)
export default function InviteView({ data, link, backHref }: { data: ReferralOverview | null; link: string; backHref: string }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-[#233c5e]">
          <ArrowLeft size={15} aria-hidden /> Home
        </Link>
        <p className="eyebrow mt-3">Sconto sul piano</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#233c5e] sm:text-4xl">Invita un collega</h1>
        <p className="mt-2 text-sm text-slate-600">
          Per ogni collega che arriva dal tuo link, quando è verificato e ha iniziato a lavorare su Grand Route, <strong>−{REWARD_PCT}% per {REWARD_MONTHS} mesi</strong> a te e a lui. Lo sconto si applicherà quando partiranno i piani a pagamento.
        </p>
      </div>

      {!data ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Per usare gli inviti serve l&apos;aggiornamento del database (migrazione 0074, in Supabase → SQL Editor).
        </p>
      ) : (
        <>
          {data.invited_by && (
            <section className="flex items-start gap-3 rounded-2xl border border-[#cda876] bg-[#fdf6e6] p-4 text-sm text-[#233c5e]">
              <Gift size={20} className="mt-0.5 shrink-0 text-[#c58f2d]" aria-hidden />
              <p>
                <strong>Sei stato invitato da {data.invited_by.name}.</strong>{" "}
                {data.invited_by.state === "attivo"
                  ? `Il tuo sconto di benvenuto è maturato: −${REWARD_PCT}% per ${REWARD_MONTHS} mesi.`
                  : data.invited_by.state === "non_valido"
                    ? "L'invito non conta perché avete la stessa partita IVA."
                    : `Avrai −${REWARD_PCT}% per ${REWARD_MONTHS} mesi quando il tuo profilo sarà verificato e avrai iniziato a lavorare (un viaggio, un ordine o una collaborazione).`}
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-[#233c5e]">Il tuo link</h2>
            <InviteShare link={link} />
          </section>

          <section className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
              <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-[#233c5e]">{data.invitees.length}</p>
              <p className="text-xs text-slate-500">invitati</p>
            </div>
            <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
              <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-emerald-700">{data.active}</p>
              <p className="text-xs text-slate-500">attivi</p>
            </div>
            <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
              <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-[#233c5e]">{data.banked_months}</p>
              <p className="text-xs text-slate-500">mesi di −{REWARD_PCT}% maturati</p>
            </div>
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#233c5e]"><Users size={18} className="text-[#c58f2d]" aria-hidden /> Chi hai invitato</h2>
            {data.invitees.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#e6d7bb] bg-white/70 p-4 text-sm text-slate-500">Ancora nessuno: manda il tuo link a un collega.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.invitees.map((i, n) => (
                  <li key={n} className="rounded-xl border border-[#e6d7bb] bg-white p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-[#233c5e]">{i.name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATE_LABEL[i.state].tone}`}>{STATE_LABEL[i.state].label}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Registrato il {dayIt(i.since)} — {STATE_LABEL[i.state].hint}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[#e6d7bb] bg-[#faf3e6]/60 p-5 text-sm text-slate-700">
            <h2 className="text-base font-semibold text-[#233c5e]">Come funziona</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Il collega si registra dal tuo link come professionista (agenzia, tour operator, guida, autista, struttura…).</li>
              <li>L&apos;invito diventa <strong>attivo</strong> quando il nostro team ha verificato il suo profilo e lui ha iniziato a lavorare: un viaggio creato, un ordine o una collaborazione accettata.</li>
              <li>Ogni invito attivo vale {REWARD_MONTHS} mesi di −{REWARD_PCT}% (fino a {MAX_BANKED_MONTHS} mesi accumulati). Il totale degli sconti, insieme a quello dei viaggi verificati, non supera il 40%.</li>
              <li>Non contano inviti tra attività con la stessa partita IVA. Lo sconto può essere tolto in caso di abusi.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
