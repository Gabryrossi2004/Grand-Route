import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Zefiro from "@/components/Zefiro";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { greetingFor, type BriefingItem } from "@/lib/agencyBriefing";

const TONES = {
  alert: { icon: AlertTriangle, className: "text-red-600", bg: "bg-red-50" },
  warn: { icon: AlertTriangle, className: "text-amber-600", bg: "bg-amber-50" },
  info: { icon: Info, className: "text-[#233c5e]", bg: "bg-[#eef2f8]" },
} as const;

// Il briefing di Zefiro in Home: cosa merita attenzione oggi.
export default function ZefiroBriefing({ items, hour }: { items: BriefingItem[]; hour: number }) {
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
      {items.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle2 size={16} className="shrink-0 text-green-600" />
          Nessuna partenza imminente, nessun documento o pagamento in sospeso.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {items.map((item) => {
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
        </ul>
      )}
    </section>
  );
}
