import { CalendarClock, FileCheck2, Gift, Globe2, Headphones, LifeBuoy, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { levelFor, parseLevels, pointsFrom } from "@/lib/benefits";

export const metadata = { title: "I tuoi vantaggi" };

type AgencyBenefits = {
  agency_name: string | null;
  logo_url: string | null;
  has_emergency: boolean;
  enabled: boolean;
  euros_per_point: number;
  intro: string | null;
  levels: unknown;
  paid: number;
  bonus: number;
  history: { points: number; reason: string; created_at: string }[];
  offers: { id: string; title: string; body: string | null; valid_until: string | null }[];
};

const dateIt = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

function Included({ hasEmergency }: { hasEmergency: boolean }) {
  const items = [
    { icon: Headphones, title: "Una persona vera a cui scrivere", text: "Chatti con la tua agenzia prima, durante e dopo il viaggio: cambi, dubbi e imprevisti li gestisce lei." },
    ...(hasEmergency ? [{ icon: LifeBuoy, title: "Numero per le emergenze", text: "Durante il viaggio hai un numero dedicato da chiamare in caso di problemi, con un tocco dall'app." }] : []),
    { icon: FileCheck2, title: "Documenti sempre con te", text: "Biglietti, voucher e programma giorno per giorno, consultabili anche senza connessione." },
    { icon: CalendarClock, title: "Avvisi e promemoria", text: "Ti ricordiamo documenti, pagamenti e partenza, così non devi pensarci tu." },
    { icon: Globe2, title: "Mappamondo e diario dei ricordi", text: "I paesi visitati diventano d'oro e raccogli foto e note di ogni luogo." },
    { icon: ShieldCheck, title: "Più tutele con il pacchetto turistico", text: "Se acquisti un pacchetto turistico, la legge ti garantisce assistenza se sei in difficoltà durante il viaggio e protezione in caso di fallimento dell'organizzatore." },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#faf3e6] text-[#c58f2d]">
            <Icon size={18} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            <span className="block text-sm text-slate-600">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ClientBenefitsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_benefits");
  const agencies = error ? [] : ((data as AgencyBenefits[] | null) ?? []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">I tuoi vantaggi</h1>
        <p className="mt-1 text-sm text-slate-600">Cosa hai in più viaggiando con la tua agenzia.</p>
      </div>

      {agencies.length === 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#233c5e]">Inclusi nel tuo viaggio</h2>
          <Included hasEmergency={false} />
        </section>
      )}

      {agencies.map((a, i) => {
        const levels = parseLevels(a.levels);
        const points = pointsFrom(Number(a.paid), Number(a.euros_per_point), Number(a.bonus));
        const { current, next } = levelFor(points, levels);
        const base = current?.min ?? 0;
        const progress = next ? Math.min(100, Math.round(((points - base) / Math.max(1, next.min - base)) * 100)) : 100;
        return (
          <div key={i} className="flex flex-col gap-6">
            {agencies.length > 1 && (
              <p className="flex items-center gap-2 text-sm font-semibold text-[#756548]">
                {a.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.logo_url} alt="" className="h-7 w-7 rounded-lg bg-white object-contain p-0.5" />
                )}
                {a.agency_name}
              </p>
            )}

            {a.enabled && (
              <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#233c5e] to-[#34527c] p-6 text-white">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
                  <Gift size={14} /> Programma fedeltà{a.agency_name ? ` di ${a.agency_name}` : ""}
                </p>
                <p className="mt-2 text-4xl font-semibold">
                  {points} <span className="text-lg font-normal text-white/80">punti</span>
                </p>
                {current && <p className="mt-1 text-sm">Livello «{current.name}»: {current.perks}</p>}
                {next && (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-[#e3b04b]" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-white/80">
                      Mancano {next.min - points} punti per «{next.name}»: {next.perks}
                    </p>
                  </div>
                )}
                {a.intro && <p className="mt-4 text-sm text-white/85">{a.intro}</p>}
                <p className="mt-3 text-xs text-white/60">Guadagni 1 punto ogni {Number(a.euros_per_point)} € pagati per i tuoi viaggi, più i bonus dell&apos;agenzia.</p>
              </section>
            )}

            {a.offers.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-[#233c5e]">Offerte riservate a te</h2>
                <ul className="flex flex-col gap-3">
                  {a.offers.map((o) => (
                    <li key={o.id} className="rounded-2xl border border-[#e3b04b] bg-white p-4">
                      <p className="font-semibold text-slate-900">{o.title}</p>
                      {o.valid_until && <p className="text-xs text-[#a87a1e]">Valida fino al {dateIt(o.valid_until)}</p>}
                      {o.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{o.body}</p>}
                      <p className="mt-2 text-xs text-slate-500">Per richiederla scrivi alla tua agenzia dalla chat del viaggio.</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-lg font-semibold text-[#233c5e]">Inclusi nel tuo viaggio</h2>
              <Included hasEmergency={a.has_emergency} />
            </section>

            {a.enabled && levels.length > 1 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-[#233c5e]">I livelli</h2>
                <ul className="flex flex-col gap-2">
                  {levels.map((l) => (
                    <li key={l.name} className={`rounded-xl border p-3 text-sm ${current?.name === l.name ? "border-[#233c5e] bg-[#233c5e]/5" : "border-[#e6d7bb] bg-white"}`}>
                      <span className="font-semibold text-slate-900">{l.name}</span> <span className="text-slate-500">· da {l.min} punti</span>
                      <span className="block text-slate-600">{l.perks}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {a.enabled && a.history.length > 0 && (
              <section>
                <h2 className="mb-2 text-lg font-semibold text-[#233c5e]">Bonus e premi</h2>
                <ul className="divide-y divide-[#f0e6d2] rounded-2xl border border-[#e6d7bb] bg-white px-4 text-sm">
                  {a.history.map((h, k) => (
                    <li key={k} className="flex justify-between gap-2 py-2">
                      <span>{h.reason}</span>
                      <strong className={h.points > 0 ? "text-emerald-700" : "text-red-600"}>{h.points > 0 ? `+${h.points}` : h.points}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        );
      })}
    </div>
  );
}
