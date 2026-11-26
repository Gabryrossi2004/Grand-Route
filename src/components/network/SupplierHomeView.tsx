import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, CalendarDays, CheckCircle2, Circle, ClipboardList, FileText, Inbox, Mail, Plus, Receipt, Search } from "lucide-react";
import ServiceCard from "@/components/network/ServiceCard";
import { addDays } from "@/lib/orders/shared";
import { dayLabel, onDay, waitingForMe, type AgendaRow } from "@/lib/network/agenda";
import { greetingFor, type AccountingBriefingData } from "@/lib/agencyBriefing";
import GettingStarted from "@/components/GettingStarted";
import { progressOf, supplierSteps, type OnboardingStatus } from "@/lib/onboarding";

type Tile = { label: string; count: number; href: string; icon: React.ReactNode; urgent?: boolean };

export type SupplierHomeData = {
  me: string;
  today: string;
  hour: number;
  agendaError: boolean;
  agenda: AgendaRow[];
  acc: unknown;
  profile: unknown;
  filesCount: number | null;
  unread: unknown;
  collab: unknown;
  mail: unknown;
  pendingAgencies: number;
  onboarding: OnboardingStatus | null;
};

// Home del fornitore (guida, autista, struttura…): cosa c'è oggi, cosa aspetta una risposta, cosa fatturare.
export default function SupplierHomeView({ me, today, hour, agendaError, agenda, acc, profile, filesCount, unread, collab, mail, pendingAgencies, onboarding }: SupplierHomeData) {
  const steps = onboarding ? supplierSteps(onboarding) : [];
  const user = { id: me };
  const rows = agenda.filter((r) => r.phase !== "svolto" && r.phase !== "fatturato");
  const toConfirm = rows.filter((r) => waitingForMe(r, user.id));
  const todayRows = rows.filter((r) => onDay(r, today) && !waitingForMe(r, user.id));
  const next7 = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
  const upcoming = next7.map((d) => ({ day: d, items: rows.filter((r) => r.service_date === d && !waitingForMe(r, user.id)) })).filter((g) => g.items.length);

  const a = (acc ?? null) as AccountingBriefingData | null;
  const p = profile as { business_name?: string; status?: string; cover_path?: string | null; logo_path?: string | null; tagline?: string | null; gallery?: string[] | null; listed?: boolean } | null;

  const tiles: Tile[] = [
    { label: toConfirm.length === 1 ? "richiesta da confermare" : "richieste da confermare", count: toConfirm.length, href: "#da-confermare", icon: <ClipboardList size={20} />, urgent: true },
    { label: "variazioni contestate", count: a?.extras_contested ?? 0, href: "/rete/lavori", icon: <ClipboardList size={20} />, urgent: true },
    { label: (a?.to_collect ?? []).length === 1 ? "fattura scaduta non pagata" : "fatture scadute non pagate", count: (a?.to_collect ?? []).length, href: "/rete/fatture", icon: <Receipt size={20} />, urgent: true },
    { label: (a?.billable ?? 0) === 1 ? "servizio da fatturare" : "servizi da fatturare", count: a?.billable ?? 0, href: "/rete/lavori", icon: <FileText size={20} /> },
    { label: (a?.drafts ?? 0) === 1 ? "fattura in bozza" : "fatture in bozza", count: a?.drafts ?? 0, href: "/rete/fatture", icon: <FileText size={20} /> },
    { label: pendingAgencies === 1 ? "agenzia da sollecitare per la riconferma" : "agenzie da sollecitare per la riconferma", count: pendingAgencies, href: "/rete/agenda#riconferme", icon: <Mail size={20} />, urgent: true },
    { label: "messaggi da leggere", count: typeof mail === "number" ? mail : 0, href: "/rete/posta", icon: <Mail size={20} /> },
    {
      label: "richieste di contatto o collaborazione",
      count: (typeof unread === "number" ? unread : 0) + (typeof collab === "number" ? collab : 0),
      href: "/rete/messaggi",
      icon: <Inbox size={20} />,
    },
  ].filter((t) => t.count > 0);

  // Vetrina: cosa manca per essere scelti dalle agenzie
  const checks = p
    ? [
        { ok: p.status === "verificato", label: p.status === "in_verifica" ? "Profilo in verifica dal team" : "Profilo verificato" },
        { ok: !!p.cover_path, label: "Foto di copertina" },
        { ok: !!p.logo_path, label: "Logo o foto profilo" },
        { ok: !!p.tagline, label: "Slogan di una riga" },
        { ok: (p.gallery ?? []).length >= 3, label: "Almeno 3 foto nella galleria" },
        { ok: (filesCount ?? 0) > 0, label: "Almeno un listino" },
      ]
    : [];
  const missing = checks.filter((c) => !c.ok).length;

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">{dayLabel(today, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="mt-1 text-3xl text-[#233c5e] sm:text-4xl">
          {greetingFor(hour)}
          {p?.business_name ? `, ${p.business_name}` : ""}
        </h1>
      </div>

      {onboarding && !onboarding.hidden && <GettingStarted steps={steps} />}
      {onboarding?.hidden && !progressOf(steps).complete && (
        <Link href="/rete/home?iniziare=1" className="inline-block text-xs font-medium text-[#756548] hover:text-[#233c5e] hover:underline">Riapri la lista «Per iniziare»</Link>
      )}

      {agendaError && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Per vedere i servizi qui serve l&apos;aggiornamento del database (migrazione 0069, in Supabase → SQL Editor). Intanto li trovi in Servizi.
        </p>
      )}

      {/* Cose da fare */}
      <section>
        {tiles.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl border border-[#e6d7bb] bg-white px-4 py-3 text-base text-slate-700">
            <CheckCircle2 size={20} className="shrink-0 text-emerald-600" /> Nessuna richiesta in sospeso: è tutto in ordine.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className={`flex min-h-24 flex-col justify-between rounded-2xl border p-3.5 transition active:scale-[0.98] ${
                  t.urgent ? "border-[#c58f2d] bg-[#fff8ea] hover:bg-[#fdf0d6]" : "border-[#e6d7bb] bg-white hover:bg-[#faf3e6]"
                }`}
              >
                <span className={`flex items-center justify-between ${t.urgent ? "text-[#9a6412]" : "text-[#233c5e]"}`}>
                  <span className="text-3xl font-semibold leading-none">{t.count}</span>
                  {t.icon}
                </span>
                <span className="mt-2 text-sm font-medium leading-snug text-slate-700">{t.label}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {toConfirm.length > 0 && (
        <section id="da-confermare" className="scroll-mt-24">
          <h2 className="mb-2 text-lg font-semibold text-[#233c5e]">Da confermare</h2>
          <div className="space-y-3">
            {toConfirm.map((r) => (
              <ServiceCard key={r.id} row={r} me={user.id} today={today} showDate />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#233c5e]">Oggi</h2>
          <Link href="/rete/agenda" className="inline-flex items-center gap-1 text-sm font-medium text-[#233c5e] underline">
            <CalendarDays size={15} /> Agenda
          </Link>
        </div>
        {todayRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/60 px-4 py-4 text-sm text-slate-600">Oggi non hai servizi in programma.</p>
        ) : (
          <div className="space-y-3">
            {todayRows.map((r) => (
              <ServiceCard key={r.id} row={r} me={user.id} today={today} />
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-[#233c5e]">Prossimi 7 giorni</h2>
          <div className="space-y-4">
            {upcoming.map((g) => (
              <div key={g.day}>
                <p className="mb-1.5 text-sm font-semibold capitalize text-slate-600">{dayLabel(g.day)}</p>
                <div className="space-y-3">
                  {g.items.map((r) => (
                    <ServiceCard key={r.id} row={r} me={user.id} today={today} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link href="/rete/agenda" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#233c5e]">
            Apri l&apos;agenda completa <ArrowRight size={15} />
          </Link>
        </section>
      )}

      {p && missing > 0 && (
        <section className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#233c5e]"><BadgeCheck size={19} /> La tua vetrina</h2>
          <p className="mt-1 text-sm text-slate-600">Le agenzie scelgono più volentieri chi ha una scheda completa. Ti mancano {missing === 1 ? "1 cosa" : `${missing} cose`}:</p>
          <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            {checks.map((c) => (
              <li key={c.label} className={`flex items-center gap-2 ${c.ok ? "text-slate-500" : "font-medium text-slate-800"}`}>
                {c.ok ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <Circle size={16} className="shrink-0 text-[#c58f2d]" />} {c.label}
              </li>
            ))}
          </ul>
          <Link href="/rete/profilo" className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#233c5e] px-4 text-sm font-semibold text-white hover:bg-[#17283f]">
            Completa il profilo <ArrowRight size={15} />
          </Link>
        </section>
      )}
      {!p && (
        <section className="rounded-2xl border border-[#c58f2d] bg-[#fff8ea] p-4">
          <h2 className="text-lg font-semibold text-[#233c5e]">Completa il tuo profilo</h2>
          <p className="mt-1 text-sm text-slate-700">Senza profilo le agenzie non ti trovano nell&apos;elenco dei Partner.</p>
          <Link href="/rete/profilo" className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#233c5e] px-4 text-sm font-semibold text-white hover:bg-[#17283f]">
            Compila il profilo <ArrowRight size={15} />
          </Link>
        </section>
      )}

      <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {[
          { href: "/rete/lavori", label: "Registra un servizio", icon: <Plus size={18} /> },
          { href: "/rete/fatture", label: "Le mie fatture", icon: <Receipt size={18} /> },
          { href: "/rete/statistiche", label: "Statistiche e andamento", icon: <BarChart3 size={18} /> },
          { href: "/rete/messaggi", label: "Richieste e collaborazioni", icon: <Inbox size={18} /> },
          { href: "/rete", label: "Trova altri partner", icon: <Search size={18} /> },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-[#e6d7bb] bg-white px-4 text-sm font-semibold text-[#233c5e] transition hover:bg-[#faf3e6] active:scale-[0.98]">
            {q.icon} {q.label}
          </Link>
        ))}
      </section>
    </div>
  );
}
