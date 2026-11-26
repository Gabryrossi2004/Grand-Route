import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import RottaProgress from "@/components/RottaProgress";
import ReminderButton from "@/components/ReminderButton";
import { STATE_TEXT, type RottaRow, type RottaSummary } from "@/lib/rotta";

export const metadata = { title: "Sconto Rotta" };

const dayIt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

export default async function RottaPage() {
  const user = await getCachedUser();
  if (!user) redirect("/professionisti?next=/dashboard/sconto");
  const supabase = await createClient();
  const [{ data: summary, error }, { data: list }] = await Promise.all([supabase.rpc("rotta_summary"), supabase.rpc("rotta_trip_list")]);
  const s = (summary as RottaSummary | null) ?? null;
  const rows = (list as RottaRow[] | null) ?? [];

  const verified = rows.filter((r) => r.counted);
  const pending = rows.filter((r) => r.state === "in_attesa");
  const others = rows.filter((r) => !r.counted && r.state !== "in_attesa");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-[#233c5e]">
          <ArrowLeft size={15} aria-hidden /> Home
        </Link>
        <p className="eyebrow mt-3">Sconto sul piano</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-[#233c5e] sm:text-4xl">Sconto Rotta</h1>
        <p className="mt-2 text-sm text-slate-600">
          Più viaggi verificati hai su Grand Route, più lo sconto sul tuo piano. Lo sconto si applicherà quando partiranno i piani a pagamento: intanto i viaggi si contano già.
        </p>
      </div>

      {!s || error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Per vedere lo Sconto Rotta serve l&apos;aggiornamento del database (migrazione 0073, in Supabase → SQL Editor).
        </p>
      ) : (
        <>
          <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-[#233c5e]">{s.verified}</p>
                <p className="text-xs text-slate-500">viaggi verificati</p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-[#233c5e]">−{s.discount}%</p>
                <p className="text-xs text-slate-500">sconto raggiunto</p>
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl font-medium text-amber-700">{s.pending}</p>
                <p className="text-xs text-slate-500">in attesa di conferma</p>
              </div>
            </div>
            <div className="mt-5 px-3">
              <RottaProgress s={s} />
            </div>
            <p className="mt-2 text-center text-sm text-slate-600">
              {s.next_at ? `Ancora ${s.next_at - s.verified} ${s.next_at - s.verified === 1 ? "viaggio" : "viaggi"} per il −${s.next_discount}%.` : "Hai raggiunto il traguardo massimo."}
            </p>
          </section>

          <section className="rounded-2xl border border-[#e6d7bb] bg-[#faf3e6]/60 p-5 text-sm text-slate-700">
            <h2 className="text-base font-semibold text-[#233c5e]">Quando un viaggio conta</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>l&apos;itinerario è in stadio <strong>Finale</strong> e il rientro è già avvenuto (negli ultimi 12 mesi);</li>
              <li>il viaggio ha un <strong>cliente con un account</strong> nell&apos;area clienti, con un&apos;email diversa dalla tua;</li>
              <li>c&apos;è <strong>una conferma indipendente</strong>: il cliente tocca «Sì, ho fatto il viaggio», oppure un fornitore verificato ha confermato un servizio che hai ordinato per quel viaggio su Grand Route;</li>
              <li>al massimo 2 viaggi per lo stesso cliente ogni 12 mesi. Lo sconto può essere tolto in caso di abusi.</li>
            </ul>
          </section>

          {pending.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#233c5e]"><Clock size={18} className="text-amber-700" aria-hidden /> In attesa di conferma</h2>
              <ul className="flex flex-col gap-2">
                {pending.map((r) => (
                  <li key={r.trip_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6d7bb] bg-white p-3.5">
                    <div className="min-w-0">
                      <Link href={`/dashboard/trips/${r.trip_id}`} className="block truncate font-medium text-[#233c5e] hover:underline">{r.title}</Link>
                      <p className="text-xs text-slate-500">{r.client_name} · rientro {dayIt(r.end_day)}</p>
                    </div>
                    <ReminderButton tripId={r.trip_id} sentAt={r.reminder_sent_at} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#233c5e]"><CheckCircle2 size={18} className="text-emerald-600" aria-hidden /> Verificati</h2>
            {verified.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#e6d7bb] bg-white/70 p-4 text-sm text-slate-500">Ancora nessun viaggio verificato.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {verified.map((r) => (
                  <li key={r.trip_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e6d7bb] bg-white p-3.5">
                    <div className="min-w-0">
                      <Link href={`/dashboard/trips/${r.trip_id}`} className="block truncate font-medium text-[#233c5e] hover:underline">{r.title}</Link>
                      <p className="text-xs text-slate-500">{r.client_name} · rientro {dayIt(r.end_day)}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      Confermato dal {r.confirmed_by === "fornitore" ? "fornitore" : "cliente"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {others.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[#233c5e]"><XCircle size={18} className="text-slate-400" aria-hidden /> Non contano</h2>
              <ul className="flex flex-col gap-2">
                {others.map((r) => (
                  <li key={r.trip_id} className="rounded-xl border border-[#e6d7bb] bg-white/70 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/dashboard/trips/${r.trip_id}`} className="min-w-0 truncate font-medium text-[#233c5e] hover:underline">{r.title}</Link>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{STATE_TEXT[r.state].label}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{r.client_name} · rientro {dayIt(r.end_day)} — {STATE_TEXT[r.state].why}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
