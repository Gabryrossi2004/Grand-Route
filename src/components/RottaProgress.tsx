import { TIERS, type RottaSummary } from "@/lib/rotta";

// Barra con i tre traguardi (5 · 15 · 40 viaggi verificati) e lo sconto raggiunto
export default function RottaProgress({ s }: { s: RottaSummary }) {
  const max = TIERS[TIERS.length - 1].at;
  const pct = Math.min(100, (s.verified / max) * 100);
  return (
    <div className="px-5">
      <div className="relative h-3 rounded-full bg-[#e6d7bb]" role="progressbar" aria-valuenow={s.verified} aria-valuemin={0} aria-valuemax={max}>
        <div className="h-full rounded-full bg-gradient-to-r from-[#233c5e] to-[#34527c]" style={{ width: `${pct}%` }} />
        {TIERS.map((t) => (
          <span
            key={t.at}
            aria-hidden
            className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${s.verified >= t.at ? "border-[#233c5e] bg-[#cda876]" : "border-[#cbbfa6] bg-white"}`}
            style={{ left: `${(t.at / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="relative mt-2 h-8 text-xs text-slate-600">
        {TIERS.map((t) => (
          <span key={t.at} className="absolute -translate-x-1/2 whitespace-nowrap text-center leading-tight" style={{ left: `${(t.at / max) * 100}%` }}>
            <strong className="block text-[#233c5e]">−{t.pct}%</strong>
            {t.at} viaggi
          </span>
        ))}
      </div>
    </div>
  );
}
