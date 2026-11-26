import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Eye, Handshake, Minus } from "lucide-react";
import MonthlyChart from "@/components/network/MonthlyChart";
import { PERIODS, deltaText, hoursText, type PeriodId, type StatsData } from "@/lib/network/stats";
import { dayLabel } from "@/lib/network/agenda";
import { fmtMoney } from "@/lib/orders/shared";

const card = "rounded-2xl border border-[#e6d7bb] bg-white p-4 sm:p-5";
const num = (n: number | null | undefined) => Number(n ?? 0);

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const d = deltaText(cur, prev);
  if (!d) return null;
  const Icon = d.tone === "up" ? ArrowUpRight : d.tone === "down" ? ArrowDownRight : Minus;
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs ${d.tone === "up" ? "text-emerald-700" : d.tone === "down" ? "text-red-700" : "text-slate-500"}`}>
      <Icon size={14} aria-hidden /> {d.text}
    </p>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className={card}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-medium leading-tight text-[#233c5e]">{value}</p>
      {children}
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#f2e2c4] py-2 last:border-0">
      <dt className="text-sm text-slate-600">{label}{hint && <span className="block text-xs text-slate-400">{hint}</span>}</dt>
      <dd className="text-right text-base font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

// Statistiche del fornitore: servizi, fatturato, incassi, clienti, andamento e visite alla vetrina.
export default function StatsView({ data, periodo }: { data: StatsData; periodo: PeriodId }) {
  const cur = data.currency;
  const done = num(data.now.done) + num(data.now.penalty);
  const prevDone = num(data.prev.done);
  const revenue = num(data.now.revenue);
  const empty = done === 0 && num(data.now.upcoming) === 0 && num(data.now.pending) === 0 && revenue === 0 && num(data.requests.received) === 0;
  const otherCur = Object.entries(data.now.other ?? {});
  const topMax = Math.max(1, ...data.top_clients.map((c) => num(c.amount)));
  const received = num(data.requests.received);
  const accepted = num(data.requests.accepted);
  const acceptedPct = received > 0 ? Math.round((accepted / received) * 100) : null;
  const views = num(data.profile.views);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Periodo">
        {PERIODS.map((p) => (
          <Link
            key={p.id}
            href={p.id === "3mesi" ? "/rete/statistiche" : `/rete/statistiche?periodo=${p.id}`}
            role="tab"
            aria-selected={periodo === p.id}
            className={`min-h-11 rounded-full px-4 py-2.5 text-sm font-semibold ${periodo === p.id ? "bg-[#233c5e] text-white" : "border border-[#e6d7bb] bg-white text-[#233c5e]"}`}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        Dal {dayLabel(data.from, { day: "numeric", month: "long", year: "numeric" })} al {dayLabel(data.to, { day: "numeric", month: "long", year: "numeric" })}. Importi senza IVA.
      </p>

      {empty && (
        <p className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 px-4 py-5 text-slate-600">
          Ancora nessun dato in questo periodo. Appena avrai servizi, richieste e fatture, qui vedrai come stai lavorando.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Servizi svolti" value={String(done)}>
          <Delta cur={done} prev={prevDone} />
          {num(data.now.upcoming) > 0 && <p className="mt-1 text-xs text-slate-500">{num(data.now.upcoming)} ancora in programma</p>}
        </Tile>
        <Tile label="Fatturato" value={fmtMoney(revenue, cur)}>
          <Delta cur={revenue} prev={num(data.prev.revenue)} />
          {otherCur.length > 0 && <p className="mt-1 text-xs text-slate-500">In più: {otherCur.map(([c, a]) => fmtMoney(num(a), c)).join(", ")}</p>}
        </Tile>
        <Tile label="Incassato" value={fmtMoney(num(data.invoices.collected), cur)}>
          <p className="mt-1 text-xs text-slate-500">
            {data.invoices.avg_days_to_pay != null ? `Le agenzie pagano in media dopo ${num(data.invoices.avg_days_to_pay)} giorni` : "Fatture pagate nel periodo"}
          </p>
        </Tile>
        <Tile label="Ancora da incassare" value={fmtMoney(num(data.invoices.outstanding), cur)}>
          {num(data.invoices.overdue_count) > 0 ? (
            <Link href="/rete/fatture" className="mt-1 block text-xs font-medium text-red-700 underline">{num(data.invoices.overdue_count)} {num(data.invoices.overdue_count) === 1 ? "fattura scaduta" : "fatture scadute"}</Link>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Nessuna fattura scaduta</p>
          )}
          {num(data.invoices.to_bill) > 0 && (
            <Link href="/rete/lavori" className="mt-0.5 block text-xs font-medium text-[#233c5e] underline">{num(data.invoices.to_bill)} {num(data.invoices.to_bill) === 1 ? "servizio" : "servizi"} da fatturare</Link>
          )}
        </Tile>
      </div>

      <section className={card}>
        <h2 className="text-lg font-semibold text-[#233c5e]">Fatturato mese per mese</h2>
        <p className="mb-3 text-sm text-slate-500">Servizi svolti degli ultimi 12 mesi, in {cur === "EUR" ? "euro" : cur}, senza IVA. Passa sopra una colonna per i dettagli.</p>
        <MonthlyChart months={data.months} currency={cur} from={data.from} to={data.to} />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-lg font-semibold text-[#233c5e]">Come lavori con le agenzie</h2>
          <dl className="mt-2">
            <Row label="Richieste ricevute" value={received} hint="servizi chiesti da agenzie e tour operator" />
            <Row label="Accettate" value={acceptedPct != null ? `${accepted} (${acceptedPct}%)` : "—"} />
            <Row label="Rifiutate" value={num(data.requests.declined)} />
            <Row label="Tempo medio di risposta" value={hoursText(data.requests.avg_hours)} hint="da quando arriva la richiesta alla tua conferma" />
            <Row label="Da confermare ora" value={num(data.now.pending)} />
            <Row label="Annullati" value={num(data.now.cancelled)} hint={num(data.now.penalty) > 0 ? `più ${num(data.now.penalty)} con penale incassata` : undefined} />
          </dl>
        </section>

        <section className={card}>
          <h2 className="text-lg font-semibold text-[#233c5e]">Le agenzie che ti fanno lavorare di più</h2>
          {data.top_clients.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Nessun servizio svolto nel periodo.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {data.top_clients.map((c, i) => (
                <li key={`${c.name}-${i}`}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-slate-800">{i + 1}. {c.name}</span>
                    <span className="shrink-0 font-semibold text-slate-900">{fmtMoney(num(c.amount), cur)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[#f2e8d2]" aria-hidden>
                    <div className="h-2 rounded-full bg-[#233c5e]" style={{ width: `${Math.max(3, Math.round((num(c.amount) / topMax) * 100))}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{c.services} {c.services === 1 ? "servizio" : "servizi"}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[#233c5e]"><Eye size={19} /> La tua vetrina</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#faf7ee] p-3">
            <p className="text-3xl font-semibold text-[#233c5e]">{views}</p>
            <p className="text-sm text-slate-600">{views === 1 ? "professionista ha visto" : "professionisti hanno visto"} la tua scheda</p>
            <Delta cur={views} prev={num(data.profile.views_prev)} />
          </div>
          <div className="rounded-xl bg-[#faf7ee] p-3">
            <p className="flex items-center gap-2 text-3xl font-semibold text-[#233c5e]"><Handshake size={22} aria-hidden /> {num(data.profile.collab_received)}</p>
            <p className="text-sm text-slate-600">richieste di collaborazione ricevute{num(data.profile.collab_received) > 0 ? `, ${num(data.profile.collab_accepted)} accettate` : ""}</p>
          </div>
          <div className="rounded-xl bg-[#faf7ee] p-3">
            <p className="text-3xl font-semibold text-[#233c5e]">{num(data.profile.partners)}</p>
            <p className="text-sm text-slate-600">{num(data.profile.partners) === 1 ? "partner attivo" : "partner attivi"}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Le visite contano ogni professionista una volta al giorno e non mostrano chi sia stato. Non contano le tue.</p>
        {views < 5 && (
          <Link href="/rete/profilo" className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#233c5e] px-4 text-sm font-semibold text-white hover:bg-[#17283f]">
            Completa la vetrina per farti trovare di più <ArrowRight size={15} />
          </Link>
        )}
      </section>
    </div>
  );
}
