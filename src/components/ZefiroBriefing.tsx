import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Plane, Receipt } from "lucide-react";
import Zefiro from "@/components/Zefiro";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { greetingFor, type BriefingItem } from "@/lib/agencyBriefing";

const TONES = {
  alert: { icon: AlertTriangle, className: "text-red-600", bg: "bg-red-50" },
  warn: { icon: AlertTriangle, className: "text-amber-600", bg: "bg-amber-50" },
  info: { icon: Info, className: "text-[#233c5e]", bg: "bg-[#eef2f8]" },
} as const;

const MAX_PER_COLUMN = 8;

function Column({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: BriefingItem[]; empty: string }) {
  const urgent = items.filter((i) => i.tone === "alert").length;
  return (
    <div className="min-w-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#233c5e]">
        {icon} {title}
        {items.length > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal ${urgent ? "bg-red-100 text-red-700" : "bg-[#233c5e]/10 text-[#233c5e]"}`}>
            {urgent ? `${urgent} urgenti · ` : ""}{items.length}
          </span>
        )}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-sm text-slate-600">
          <CheckCircle2 size={16} className="shrink-0 text-green-600" />
          {empty}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.slice(0, MAX_PER_COLUMN).map((item) => {
            const tone = TONES[item.tone];
            const Icon = tone.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-800 transition hover:brightness-95 ${tone.bg}`}
                >
                  <Icon size={16} className={`mt-0.5 shrink-0 ${tone.className}`} />
                  <span>{item.text}</span>
                </Link>
              </li>
            );
          })}
          {items.length > MAX_PER_COLUMN && (
            <li className="px-3 text-xs text-slate-500">e altre {items.length - MAX_PER_COLUMN} cose meno urgenti.</li>
          )}
        </ul>
      )}
    </div>
  );
}

// Il briefing di Zefiro in Home: cosa merita attenzione oggi, diviso tra Viaggi e Contabilità.
export default function ZefiroBriefing({ items, hour }: { items: BriefingItem[]; hour: number }) {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const trips = sorted.filter((i) => (i.area ?? "viaggi") === "viaggi");
  const money = sorted.filter((i) => i.area === "contabilita");
  return (
    <section className="rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
      <div className="flex items-center gap-3 border-b border-[#e6d7bb] pb-3">
        <Zefiro size={64} className="shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Briefing di {ASSISTANT_NAME}</p>
          <h2 className="text-xl font-medium text-[#233c5e]">
            {greetingFor(hour)}! {items.length > 0 ? "Ecco cosa merita attenzione oggi." : "Oggi è tutto in ordine."}
          </h2>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Column title="Viaggi" icon={<Plane size={15} />} items={trips} empty="Nessuna partenza imminente o documento in sospeso." />
        <Column title="Contabilità" icon={<Receipt size={15} />} items={money} empty="Nessun pagamento, fattura o variazione in sospeso." />
      </div>
    </section>
  );
}
