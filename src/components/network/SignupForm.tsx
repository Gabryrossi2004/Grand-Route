"use client";

import { areaHref, CLIENT_LOGIN } from "@/lib/areas";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Briefcase, Building2, Car, Compass, Hotel, MapPinned, Mountain, Shapes, User, Users } from "lucide-react";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";
import BusinessFields from "@/components/network/BusinessFields";
import { signup } from "@/app/signup/actions";
import { BUSINESS_KINDS, KIND_INFO, isBusinessKind, isTradeKind, type BusinessKind } from "@/lib/network/kinds";

const ICONS = { briefcase: Briefcase, building: Building2, map: MapPinned, compass: Compass, car: Car, hotel: Hotel, mountain: Mountain, shapes: Shapes };
const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";

export default function SignupForm({ initialKind, referral }: { initialKind?: string; referral?: string | null }) {
  const [state, setState] = useState<Awaited<ReturnType<typeof signup>>>();
  const [pending, start] = useTransition();
  // Invio manuale: con l'azione automatica il modulo si svuota dopo un errore e si perderebbe tutto quello che hai scritto
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => setState(await signup(undefined, fd)));
  };
  const [kind, setKind] = useState<BusinessKind>(isBusinessKind(initialKind) ? initialKind : "agenzia");
  const trade = isTradeKind(kind);
  // Account individuale (si lavora da soli) o aziendale (si possono invitare i colleghi): solo per agenzie, TO e DMC
  const [mode, setMode] = useState<"individuale" | "azienda">("individuale");
  const errors = state?.errors ?? {};

  if (state?.success) {
    return (
      <AuthShell>
        <div className="text-center">
          <AuthBrandHeader />
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Controlla la tua email</h1>
          <p className="text-sm text-slate-500">Ti abbiamo mandato un link di conferma. Clicca sul link e poi torna qui per accedere.</p>
          {!trade && (
            <p className="mt-3 text-sm text-slate-500">
              Dopo il primo accesso il tuo profilo viene controllato dal nostro team: appena è verificato compari nell&apos;elenco dei Partner.
            </p>
          )}
          <Link href="/professionisti" className="mt-6 inline-block text-sm font-medium text-[#233c5e] hover:underline">
            Vai al login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell wide>
      <AuthBrandHeader />
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Crea il tuo account</h1>
      <p className="mb-6 text-sm text-slate-500">Per chi lavora nel turismo: agenzie, tour operator, guide, autisti, strutture e fornitori.</p>
      {referral && (
        <p className="-mt-3 mb-6 rounded-xl border border-[#cda876] bg-[#fdf6e6] px-4 py-3 text-sm text-[#233c5e]">
          <strong>Sei stato invitato da un collega!</strong> Quando il tuo profilo sarà verificato e avrai iniziato a lavorare su Grand Route avrai uno sconto di benvenuto.
        </p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="accountMode" value={trade ? mode : "individuale"} />
        {referral && <input type="hidden" name="referral" value={referral} />}

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">1. Che attività svolgi?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {BUSINESS_KINDS.map((k) => {
              const Icon = ICONS[KIND_INFO[k].icon];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                    kind === k ? "border-[#233c5e] bg-[#233c5e]/5 ring-2 ring-[#233c5e]/20" : "border-[#e6d7bb] bg-white hover:border-[#c58f2d]"
                  }`}
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${kind === k ? "bg-[#233c5e] text-white" : "bg-[#faf3e6] text-[#233c5e]"}`}>
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{KIND_INFO[k].label}</span>
                    <span className="block text-xs text-slate-500">{KIND_INFO[k].short}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {trade ? "Con questo account usi il gestionale e la sezione Partner." : "Con questo account usi la sezione Partner: profilo, elenco, richieste e valutazioni."}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">2. Il tuo account</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">Nome e cognome</label>
              <input id="fullName" name="fullName" type="text" required className={input} />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input id="email" name="email" type="email" required className={input} />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input id="password" name="password" type="password" required minLength={6} className={input} />
            </div>
          </div>
          {trade && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-slate-700">Come lavori?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { id: "individuale", Icon: User, label: "Individuale", text: "Lavori da solo: un account, una persona." },
                    { id: "azienda", Icon: Users, label: "Azienda / team", text: "Puoi invitare i colleghi, ognuno con la sua email e il suo ruolo." },
                  ] as const
                ).map(({ id, Icon, label, text }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    aria-pressed={mode === id}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                      mode === id ? "border-[#233c5e] bg-[#233c5e]/5 ring-2 ring-[#233c5e]/20" : "border-[#e6d7bb] bg-white hover:border-[#c58f2d]"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${mode === id ? "bg-[#233c5e] text-white" : "bg-[#faf3e6] text-[#233c5e]"}`}>
                      <Icon size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{label}</span>
                      <span className="block text-xs text-slate-500">{text}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Puoi passare all&apos;account aziendale anche dopo, dalle Impostazioni.</p>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">3. I dati dell&apos;attività</h2>
          {trade ? (
            <details className="rounded-xl border border-[#e6d7bb] p-4">
              <summary className="cursor-pointer text-sm font-medium text-[#233c5e]">
                Facoltativo adesso: servono per comparire nell&apos;elenco dei Partner (puoi completarli dopo)
              </summary>
              <div className="mt-5">
                <BusinessFields key={kind} kind={kind} errors={errors} />
              </div>
            </details>
          ) : (
            <BusinessFields key={kind} kind={kind} errors={errors} />
          )}
          {trade && Object.keys(errors).length > 0 && <p className="mt-2 text-sm text-red-600">Apri «I dati dell&apos;attività»: ci sono campi da controllare.</p>}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">4. Consensi</h2>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" name="acceptTerms" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#233c5e] focus:ring-[#cda876]" />
            <span>
              Ho letto e accetto i{" "}
              <Link href="/termini" target="_blank" className="font-medium text-[#233c5e] hover:underline">Termini di Servizio</Link> e l&apos;
              <Link href="/privacy" target="_blank" className="font-medium text-[#233c5e] hover:underline">Informativa sulla Privacy</Link>.
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" name="acceptTruth" className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#233c5e] focus:ring-[#cda876]" />
            <span>
              Dichiaro che i dati dell&apos;attività sono veritieri e che esercito l&apos;attività indicata. So che il profilo viene controllato prima di comparire
              nell&apos;elenco, e che le valutazioni nella Rete sono anonime (solo positivo o negativo) e non si danno a chi fa il mio stesso mestiere.
              {errors.acceptTruth && <span className="ml-1 font-medium text-[#c0392b]">{errors.acceptTruth}</span>}
            </span>
          </label>
          <p className="text-xs text-slate-500">
            L&apos;accesso alla Rete è gratuito durante la fase di prova. In seguito è previsto un abbonamento di pochi euro al mese: ti avvisiamo prima.
          </p>
        </section>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#233c5e] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60"
        >
          {pending ? "Creazione account…" : "Registrati"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Hai già un account?{" "}
        <Link href="/professionisti" className="font-medium text-[#233c5e] hover:underline">Accedi</Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">
        Sei un cliente o un viaggiatore?{" "}
        <a href={areaHref("client", CLIENT_LOGIN)} className="font-medium hover:underline">Area clienti</a>
      </p>
    </AuthShell>
  );
}
