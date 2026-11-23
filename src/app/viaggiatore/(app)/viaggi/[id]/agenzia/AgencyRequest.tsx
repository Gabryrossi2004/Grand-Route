"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { sendTripToAgency } from "@/app/viaggiatore/tripActions";
import { flagOf } from "@/lib/geo/countryCodes";

export type AgencyCard = { id: string; agency_name: string; logo_url: string | null; brand_color: string | null; blurb: string | null; countries: string[] };
export type RequestRow = { id: string; agency_name: string; status: string; created_at: string };

const STATUS: Record<string, string> = { nuova: "Inviata", contattata: "L'agenzia ti ha contattato", cliente: "Sei diventato cliente", archiviata: "Chiusa" };
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#cda876]";

export default function AgencyRequest({
  tripId,
  tripCountry,
  agencies,
  requests,
  notReady,
  defaultContact,
}: {
  tripId: string;
  tripCountry: string | null;
  agencies: AgencyCard[];
  requests: RequestRow[];
  notReady: boolean;
  defaultContact: string;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState(defaultContact);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (notReady) {
    return <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per usare questa funzione serve l&apos;aggiornamento del database (migrazione 0060, Supabase → SQL Editor).</p>;
  }

  const agency = agencies.find((a) => a.id === chosen) ?? null;

  function send() {
    if (!agency) return;
    setError(null);
    start(async () => {
      const res = await sendTripToAgency(tripId, { agencyId: agency.id, message, contact, consent: consent as true });
      if (!res.ok) setError(res.error);
      else {
        setSentTo(agency.agency_name);
        setChosen(null);
        setMessage("");
        setConsent(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5">
        <h2 className="mb-1 font-semibold text-[#233c5e]">Fallo preparare da un&apos;agenzia</h2>
        <p className="text-sm text-slate-600">
          Hai già un itinerario: un&apos;agenzia di viaggi può completarlo, prenotare voli e hotel e starti vicino durante il viaggio (assistenza, numero per le emergenze, tutele del pacchetto turistico). Scegli un&apos;agenzia: le mandiamo una <strong>copia</strong> di questo itinerario, il tuo nome e il contatto che indichi. Resta tuo e puoi continuare a modificarlo.
        </p>
      </section>

      {sentTo && (
        <p className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> Richiesta mandata a {sentTo}. Ti risponderà al contatto che hai indicato.
        </p>
      )}

      {requests.length > 0 && (
        <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-[#233c5e]">Le tue richieste per questo viaggio</h3>
          <ul className="divide-y divide-[#f4ecdb] text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col py-1.5 sm:flex-row sm:justify-between sm:gap-2">
                <span className="font-medium text-slate-800">{r.agency_name}</span>
                <span className="text-xs text-slate-500 sm:text-sm">
                  {STATUS[r.status] ?? r.status} · {new Date(r.created_at).toLocaleDateString("it-IT")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {agencies.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-6 text-sm text-slate-600">Nessuna agenzia è ancora presente nell&apos;elenco. Ne arriveranno presto: riprova più avanti.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {agencies.map((a) => {
            const match = tripCountry && a.countries.includes(tripCountry);
            const on = a.id === chosen;
            return (
              <li key={a.id} className={`flex min-w-0 flex-col gap-2 rounded-2xl border bg-white p-4 ${on ? "border-[#233c5e] ring-2 ring-[#233c5e]/20" : "border-[#e6d7bb]"}`}>
                <div className="flex min-w-0 items-center gap-3">
                  {a.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-contain" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-semibold text-white" style={{ background: a.brand_color || "#233c5e" }}>
                      {a.agency_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1d2b40]">{a.agency_name}</p>
                    {match && <p className="text-xs font-medium text-emerald-700">Specialista in questa destinazione</p>}
                  </div>
                </div>
                {a.blurb && <p className="text-sm text-slate-600">{a.blurb}</p>}
                {a.countries.length > 0 && <p className="break-words text-sm">{a.countries.slice(0, 10).map((c) => flagOf(c)).join(" ")}</p>}
                <button
                  type="button"
                  onClick={() => setChosen(on ? null : a.id)}
                  className="mt-auto w-fit rounded-full border border-[#233c5e] px-4 py-1.5 text-sm font-semibold text-[#233c5e] hover:bg-[#233c5e] hover:text-white"
                >
                  {on ? "Annulla" : "Scegli questa agenzia"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {agency && (
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-[#233c5e] bg-white p-5">
          <h3 className="font-semibold text-[#233c5e]">Mandare il viaggio a {agency.agency_name}</h3>
          <label className="text-sm text-slate-700">
            Come ti contattano (email o telefono)
            <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={160} className={`${field} mt-1`} />
          </label>
          <label className="text-sm text-slate-700">
            Messaggio (facoltativo): cosa ti serve, budget, date flessibili…
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={800} className={`${field} mt-1`} />
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Acconsento a mandare a {agency.agency_name} il mio nome, il contatto indicato e una copia dell&apos;itinerario, per ricevere una proposta. L&apos;agenzia tratta i dati come titolare, secondo la sua informativa.
            </span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={pending || !consent || contact.trim().length < 3}
            onClick={send}
            className="flex w-fit items-center gap-1.5 rounded-full bg-[#233c5e] px-5 py-2 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50"
          >
            <Send size={14} /> {pending ? "Invio…" : "Manda la richiesta"}
          </button>
        </section>
      )}
    </div>
  );
}
